from urllib import urlencode
import json
from collections import defaultdict
import re

from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponse, HttpResponseBadRequest,\
    Http404, HttpResponseNotAllowed, QueryDict

from django.contrib.auth.decorators import login_required
from django.db.models.fields.related import ForeignKey
from django.db.models.fields import DateTimeField, FieldDoesNotExist
from django.utils import simplejson
from django.views.decorators.csrf import csrf_exempt

from specify import models
from specify.autonumbering import autonumber
from specify.filter_by_col import filter_by_collection

URI_RE = re.compile(r'^/api/specify/(\w+)/($|(\d+))')

inlined_fields = set([
    'Collector.agent',
    'Collectingevent.collectors',
    'Collectionobject.collectionobjectattribute',
    'Collectionobject.determinations',
    'Picklist.picklistitems',
])

class JsonDateEncoder(json.JSONEncoder):
    def default(self, obj):
        from decimal import Decimal
        if isinstance(obj, Decimal):
            return str(obj)
        if hasattr(obj, 'isoformat'):
            return obj.isoformat()
        return json.JSONEncoder.default(self, obj)

def toJson(obj):
    return json.dumps(obj, cls=JsonDateEncoder)

class RecordSetException(Exception): pass

class OptimisticLockException(Exception): pass

class MissingVersionException(OptimisticLockException): pass

class StaleObjectException(OptimisticLockException): pass

class HttpResponseConflict(HttpResponse):
    status_code = 409

class HttpResponseCreated(HttpResponse):
    status_code = 201

@login_required
@csrf_exempt
def resource(*args, **kwargs):
    try:
        return resource_dispatch(*args, **kwargs)
    except StaleObjectException as e:
        return HttpResponseConflict(e)
    except MissingVersionException as e:
        return HttpResponseBadRequest(e)

def resource_dispatch(request, model, id):
    request_params = QueryDict(request.META['QUERY_STRING'])

    # Get the version the client has.
    try:
        version = request_params['version']
    except KeyError:
        try:
            version = request.META['HTTP_IF_MATCH']
        except KeyError:
            version = None

    if request.method == 'GET':
        data = get_resource(model, id, request.GET.get('recordsetid', None))
        resp = HttpResponse(toJson(data), content_type='application/json')

    elif request.method == 'PUT':
        data = json.load(request)
        try:
            version = data['version']
        except KeyError:
            pass

        obj = put_resource(request.specify_collection,
                           request.specify_user_agent,
                           model, id, version, data)

        resp = HttpResponse(toJson(obj_to_data(obj)),
                            content_type='application/json')

    elif request.method == 'DELETE':
        delete_resource(model, id, version)
        resp = HttpResponse('', status=204)

    else:
        resp = HttpResponseNotAllowed(['GET', 'PUT', 'DELETE'])
    return resp

@login_required
@csrf_exempt
def collection(request, model):
    if request.method == 'GET':
        data = get_collection(request.specify_collection,
                              model, request.GET)
        resp = HttpResponse(toJson(data), content_type='application/json')

    elif request.method == 'POST':
        obj = post_resource(request.specify_collection,
                            request.specify_user_agent,
                            model, json.load(request),
                            request.GET.get('recordsetid', None))

        resp = HttpResponseCreated(toJson(obj_to_data(obj)),
                                   content_type='application/json')
    else:
        resp = HttpResponseNotAllowed(['GET', 'POST'])
    return resp

def get_model_or_404(name):
    if not isinstance(name, basestring): return name

    try:
        return getattr(models, name.capitalize())
    except AttributeError as e:
        raise Http404(e)

def get_object_or_404(model, *args, **kwargs):
    from django.shortcuts import get_object_or_404 as get_object

    if isinstance(model, basestring):
        model = get_model_or_404(model)
    return get_object(model, *args, **kwargs)

def get_resource(name, id, recordsetid=None):
    obj = get_object_or_404(name, id=int(id))
    data = obj_to_data(obj)
    if recordsetid is not None:
        data['recordset_info'] = get_recordset_info(obj, recordsetid)
    return data

def get_recordset_info(obj, recordsetid):
    rsis = models.Recordsetitem.objects.filter(
        recordset__id=recordsetid, recordset__dbtableid=obj.tableid)
    try:
        rsi = rsis.get(recordid=obj.id)
    except models.Recordsetitem.DoesNotExist:
        return None

    prev_rsis = rsis.filter(recordid__lt=obj.id).order_by('-recordid')
    next_rsis = rsis.filter(recordid__gt=obj.id).order_by('recordid')

    try:
        prev = uri_for_model(obj.__class__, prev_rsis[0].recordid)
    except IndexError:
        prev = None

    try:
        next = uri_for_model(obj.__class__, next_rsis[0].recordid)
    except IndexError:
        next = None

    return {
        'recordsetid': rsi.recordset_id,
        'total_count': rsis.count(),
        'index': prev_rsis.count(),
        'previous': prev,
        'next': next
        }

@transaction.commit_on_success
def post_resource(collection, agent, name, data, recordsetid=None):
    obj = create_obj(collection, agent, name, data)
    if recordsetid is not None:
        try:
            recordset = models.Recordset.objects.get(id=recordsetid)
        except models.Recordset.DoesNotExist, e:
            raise RecordSetException(e)

        if recordset.dbtableid != obj.tableid:
            raise RecordSetException("expected %s, got %s when adding object to recordset",
                                     (models.models_by_tableid[recordset.dbtableid],
                                      obj.__class__))
        recordset.recordsetitems.create(recordid=obj.id)
    return obj

def set_field_if_exists(obj, field, value):
    try:
        obj._meta.get_field(field)
    except FieldDoesNotExist:
        pass
    else:
        setattr(obj, field, value)

def create_obj(collection, agent, name, data):
    obj = get_model_or_404(name)()
    handle_fk_fields(collection, agent, obj, data)
    set_fields_from_data(obj, data)
    set_field_if_exists(obj, 'createdbyagent', agent)
    set_field_if_exists(obj, 'collectionmemberid', collection.id)
    # Have to save the object before autonumbering b/c
    # autonumber acquires a write lock on the model,
    # but save touches other tables.
    obj.save()
    autonumber(collection, agent.specifyuser, obj)
    obj.save()
    handle_to_many(collection, agent, obj, data)
    return obj

def set_fields_from_data(obj, data):
    for field_name, val in data.items():
        if field_name in ('resource_uri', 'recordset_info'): continue
        field, model, direct, m2m = obj._meta.get_field_by_name(field_name)
        if direct and not isinstance(field, ForeignKey):
            setattr(obj, field_name, prepare_value(field, val))

def handle_fk_fields(collection, agent, obj, data):
    for field_name, val in data.items():
        if field_name in ('resource_uri', 'recordset_info'): continue
        field, model, direct, m2m = obj._meta.get_field_by_name(field_name)
        if not isinstance(field, ForeignKey): continue

        if val is None:
            setattr(obj, field_name, None)

        elif isinstance(val, basestring):
            fk_model, fk_id = parse_uri(val)
            assert fk_model == field.related.parent_model.__name__.lower()
            setattr(obj, field_name + '_id', fk_id)

        elif hasattr(val, 'items'):
            rel_model = field.related.parent_model
            if 'id' in val:
                rel_obj = update_obj(collection, agent,
                                     rel_model, val['id'],
                                     val['version'], val)
            else:
                rel_obj = create_obj(collection, agent,
                                     rel_model, val)

            setattr(obj, field_name, rel_obj)
            data[field_name] = obj_to_data(rel_obj)
        else:
            raise Exception('bad foreign key field in data')

def handle_to_many(collection, agent, obj, data):
    for field_name, val in data.items():
        if not isinstance(val, list): continue
        field, model, direct, m2m = obj._meta.get_field_by_name(field_name)
        if direct: continue
        rel_model = field.model
        ids = []
        for rel_data in val:
            rel_data[field.field.name] = uri_for_model(obj.__class__, obj.id)
            if 'id' in rel_data:
                rel_obj = update_obj(collection, agent,
                                     rel_model, rel_data['id'],
                                     rel_data['version'], rel_data)
            else:
                rel_obj = create_obj(collection, agent, rel_model, rel_data)
            ids.append(rel_obj.id)

        getattr(obj, field_name).exclude(id__in=ids).delete()

@transaction.commit_on_success
def delete_resource(name, id, version):
    return delete_obj(name, id, version)

def delete_obj(name, id, version):
    obj = get_object_or_404(name, id=int(id))
    bump_version(obj, version)
    obj.delete()

@transaction.commit_on_success
def put_resource(collection, agent, name, id, version, data):
    return update_obj(collection, agent, name, id, version, data)

def update_obj(collection, agent, name, id, version, data):
    obj = get_object_or_404(name, id=int(id))
    handle_fk_fields(collection, agent, obj, data)
    set_fields_from_data(obj, data)

    try:
        obj._meta.get_field('modifiedbyagent')
    except FieldDoesNotExist:
        pass
    else:
        obj.modifiedbyagent = agent

    bump_version(obj, version)
    obj.save(force_update=True)
    handle_to_many(collection, agent, obj, data)
    return obj

def bump_version(obj, version):
    # If the object has no version field, just save it.
    try:
        obj._meta.get_field('version')
    except FieldDoesNotExist:
        return

    try:
        version = int(version)
    except (ValueError, TypeError):
        raise MissingVersionException("%s object cannot be updated without version info" % obj.__class__.__name__)

    # Update a row with the PK and the version no. we have.
    # If our version is stale, the rows updated will be 0.
    manager = obj.__class__._base_manager
    updated = manager.filter(pk=obj.pk, version=version).update(version=version+1)
    if not updated:
        raise StaleObjectException("%s object %d is out of date" % (obj.__class__.__name__, obj.id))
    obj.version = version + 1

def prepare_value(field, val):
    if isinstance(field, DateTimeField) and isinstance(val, basestring):
        return val.replace('T', ' ')
    return val

def parse_uri(uri):
    match = URI_RE.match(uri)
    if match is not None:
        groups = match.groups()
        return (groups[0], groups[2])

def obj_to_data(obj):
    data = dict((field.name, field_to_val(obj, field))
                for field in obj._meta.fields)
    data.update(dict((ro.get_accessor_name(), to_many_to_data(obj, ro))
                     for ro in obj._meta.get_all_related_objects()))
    data['resource_uri'] = uri_for_model(obj.__class__.__name__.lower(), obj.id)
    return data

def to_many_to_data(obj, related_object):
    parent_model = related_object.parent_model.__name__
    if '.'.join((parent_model, related_object.get_accessor_name())) in inlined_fields:
        objs = getattr(obj, related_object.get_accessor_name())
        return [obj_to_data(o) for o in objs.all()]

    collection_uri = uri_for_model(related_object.model)
    return collection_uri + '?' + urlencode([(related_object.field.name.lower(), str(obj.id))])

def field_to_val(obj, field):
    if isinstance(field, ForeignKey):
        if '.'.join((obj.__class__.__name__, field.name)) in inlined_fields:
            related_obj = getattr(obj, field.name)
            if related_obj is None: return None
            return obj_to_data(related_obj)
        related_id = getattr(obj, field.name + '_id')
        if related_id is None: return None
        related_model = field.related.parent_model
        return uri_for_model(related_model, related_id)
    else:
        return getattr(obj, field.name)

def get_collection(logged_in_collection, model, params={}):
    if isinstance(model, basestring):
        model = get_model_or_404(model)
    offset = 0
    limit = 20
    filters = {}
    do_domain_filter = False
    for param, val in params.items():
        if param == 'domainfilter':
            do_domain_filter = True
            continue

        if param == 'limit':
            limit = int(val)
            continue

        if param == 'offset':
            offset = int(val)
            continue

        # param is a related field
        filters.update({param: val})
    objs = model.objects.filter(**filters)
    if do_domain_filter:
        objs = filter_by_collection(objs, logged_in_collection)
    return objs_to_data(objs, offset, limit)

def objs_to_data(objs, offset=0, limit=20):
    total_count = objs.count()

    if limit == 0:
        objs = objs[offset:]
    else:
        objs = objs[offset:offset + limit]

    return {'objects': [obj_to_data(o) for o in objs],
            'meta': {'limit': limit,
                     'offset': offset,
                     'total_count': total_count}}

def uri_for_model(model, id=None):
    if not isinstance(model, basestring):
        model = model.__name__
    uri = '/api/specify/%s/' % model.lower()
    if id is not None:
        uri += '%d/' % int(id)
    return uri




