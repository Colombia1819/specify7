import tastypie.resources
from tastypie.authorization import Authorization
from tastypie.bundle import Bundle
from tastypie.exceptions import NotFound
from tastypie.http  import HttpCreated
from django.db.models import get_models
from django.db import transaction
from django.http import HttpResponse, HttpResponseBadRequest
import uuid
import hmac
import hashlib
from datetime import datetime, timedelta

from specify import models

salt = str(uuid.uuid4())

post_ttl = 30/100e-9

def time_since_uuid(past_uuid, curr_uuid=None):
    """Returns time since past_uuid was created in 100's of ns.
    If curr_uuid is supplied use that for the current time stamp.
    """
    if curr_uuid is None:
        curr_uuid = uuid.uuid1()
    that_time = past_uuid.get_time()
    curr_time = curr_uuid.get_time()
    return curr_time - that_time

class Dummy(object):
    def __init__(self, id=None):
        self.id = id

class Resource(tastypie.resources.Resource):
    def make_hmac(self, obj_uuid):
        return hmac.new(salt, obj_uuid, hashlib.sha384).hexdigest()

    def get_resource_uri(self, bundle_or_obj):
        kwargs = {'resource_name': self._meta.resource_name,}
        if isinstance(bundle_or_obj, Bundle):
            kwargs['pk'] = bundle_or_obj.obj.id
        else:
            kwargs['pk'] = bundle_or_obj.id

        if self._meta.api_name is not None:
            kwargs['api_name'] = self._meta.api_name

        return '/api/new/%(api_name)s/%(resource_name)s/%(pk)s/' % kwargs

    def post_list(self, request, **kwargs):
        new_uuid = str(uuid.uuid1())
        hmac_token = self.make_hmac(new_uuid)
        obj = Dummy('/'.join((new_uuid, hmac_token)))
        return HttpCreated(location=self.get_resource_uri(obj))

    def obj_get(self, request=None, **kwargs):
        obj_uuid, hmac_token = kwargs['pk'].split('/')
        if hmac_token != self.make_hmac(obj_uuid):
            raise NotFound()
        time_remaining = post_ttl - time_since_uuid(uuid.UUID(obj_uuid))
        if time_remaining < 0:
            raise NotFound('Pending object expired.')
        obj = Dummy(kwargs['pk'])
        return obj

def build_resource(model):
    class Meta:
        resource_name = model.__name__.lower()
        authorization = Authorization()
        object_class = Dummy
    attrs = {'Meta': Meta}
    clsname = model.__name__ + 'PostResource'
    return type(clsname, (Resource,), attrs)

resources = [build_resource(model) for model in get_models(models)]
globals().update(dict((resource.__name__, resource) for resource in resources))
