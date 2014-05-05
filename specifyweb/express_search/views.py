import re, logging
from collections import namedtuple
from datetime import date, datetime
from xml.etree import ElementTree

from sqlalchemy.sql.expression import extract, or_

from django.http import HttpResponse
from django.views.decorators.http import require_GET

from specifyweb.specify.models import datamodel
from specifyweb.specify.api import toJson, get_model_or_404, obj_to_data
from specifyweb.specify.views import login_required

from specifyweb.context.app_resource import get_app_resource

from specifyweb.stored_queries import models
from specifyweb.stored_queries.views import filter_by_collection, Session

logger = logging.getLogger(__name__)

QUOTED_STR_RE = re.compile(r'^([\'"`])(.*)\1$')


class Term(namedtuple("Term", "term is_suffix is_prefix is_number maybe_year is_integer as_date")):
    discipline = None

    @classmethod
    def make_term(cls, term):
        is_suffix = term.startswith('*')
        is_prefix = term.endswith('*')
        term = term.strip('*')

        try:
            float(term)
            is_number = True
        except ValueError:
            is_number = False

        try:
            maybe_year = 1000 <= int(term) <= date.today().year
            is_integer = True
        except ValueError:
            maybe_year = is_integer = False

        for format in ('%m/%d/%Y', '%Y-%m-%d',):
            try:
                as_date = datetime.strptime(term, format).date()
                break
            except ValueError:
                pass
        else:
            as_date = None

        return cls(term, is_suffix, is_prefix, is_number, maybe_year, is_integer, as_date)

    def create_filter(self, table, field):
        model = getattr(models, table.name)
        column = getattr(model, field.name)

        if (table.name == 'CollectionObject' and
            field.name == 'catalogNumber' and
            self.discipline):
            from specifyweb.specify.models import Splocalecontaineritem
            fieldinfo = Splocalecontaineritem.objects.get(
                container__schematype=0, # core schema
                container__discipline=self.discipline,
                name__iexact=field.name,
                container__name__iexact=table.name)

            if fieldinfo.format == 'CatalogNumberNumeric':
                if not self.is_integer: return None
                term = "%.9d" % int(self.term)
                return column == term

        filter_map = {
            'text': self.create_text_filter,
            'java.lang.String': self.create_text_filter,

            'java.lang.Integer': self.create_integer_filter,
            'java.lang.Long': self.create_integer_filter,
            'java.lang.Byte': self.create_integer_filter,
            'java.lang.Short': self.create_integer_filter,

            'java.lang.Float': self.create_float_filter,
            'java.lang.Double': self.create_float_filter,
            'java.math.BigDecimal': self.create_float_filter,

            'java.util.Calendar': self.create_date_filter,
            'java.util.Date': self.create_date_filter,
            'java.sql.Timestamp': self.create_date_filter,
            }

        create = filter_map.get(field.type, lambda f: None)
        return create(column)

    def create_text_filter(self, column):
        if self.is_prefix and self.is_suffix:
            return column.ilike('%' + self.term + '%')

        if self.is_prefix:
            return column.ilike(self.term + '%')

        if self.is_suffix:
            return column.ilike('%' + self.term)

        return column.ilike(self.term)


    def create_integer_filter(self, column):
        if self.is_integer:
            return column == int(self.term)

    def create_date_filter(self, column):
        if self.maybe_year:
            return extract('year', column) == int(self.term)

        if self.as_date:
            return column == self.as_date

    def create_float_filter(self, column):
        if self.is_number:
            return column == float(self.term)

def parse_search_str(collection, search_str):
    class TermForCollection(Term):
        discipline = collection.discipline

    match_quoted = QUOTED_STR_RE.match(search_str)
    if match_quoted:
        terms = [ match_quoted.groups()[1] ]
    else:
        terms = search_str.split()

    return map(TermForCollection.make_term, terms)

def build_query(session, searchtable, terms, collection):
    table = datamodel.get_table(searchtable.find('tableName').text)
    model = getattr(models, table.name)

    fields = [table.get_field(fn.text)
              for fn in searchtable.findall('.//searchfield/fieldName')]

    q_fields = [getattr(model, table.get_field(fn.text).name)
                for fn in searchtable.findall('.//displayfield/fieldName')]

    filters = [fltr for fltr in [
                t.create_filter(table, f) for f in fields for t in terms]
               if fltr is not None]

    if len(filters) > 0:
        reduced = reduce(or_, filters)
        id_field = getattr(model, table.idFieldName)
        query = session.query(*q_fields).filter(reduced).add_column(id_field).order_by(id_field)
        return filter_by_collection(model, query, collection)

    logger.info("no filters for query. model: %s fields: %s terms: %s", table, fields, terms)
    return None

def get_express_search_config(request):
    resource, __ = get_app_resource(request.specify_collection,
                                    request.specify_user,
                                    'ExpressSearchConfig')
    return ElementTree.XML(resource)

@require_GET
@login_required
def search(request):
    express_search_config = get_express_search_config(request)
    terms = parse_search_str(request.specify_collection, request.GET['q'])
    specific_table = request.GET.get('name', None)
    session = Session()

    def do_search(tablename, searchtable):
        query = build_query(session, searchtable, terms, request.specify_collection)
        if query is None:
            return dict(totalCount=0, results=[])

        total_count = query.count()

        if specific_table is not None:
            limit = int(request.GET.get('limit', 20))
            offset = int(request.GET.get('offset', 0))
            results = list(query.limit(limit).offset(offset))
        else:
            results = list(query)

        return dict(totalCount=total_count, results=results)

    data = {tablename: do_search(tablename, searchtable)
            for searchtable in express_search_config.findall('tables/searchtable')
            for tablename in [ searchtable.find('tableName').text.capitalize() ]
            if specific_table is None or tablename == specific_table}

    session.close()
    return HttpResponse(toJson(data), content_type='application/json')

@require_GET
@login_required
def related_search(request):
    from . import related_searches
    express_search_config = get_express_search_config(request)
    related_search = getattr(related_searches, request.GET['name'])
    related_qss = []
    for rs in related_search.get_all():
        model = rs.pivot()
        for searchtable in express_search_config.findall('tables/searchtable'):
            tablename = searchtable.find('tableName').text.capitalize()
            if tablename == model.__name__: break
        else:
            continue

        terms = parse_search_str(request.specify_collection, request.GET['q'])
        qs = build_queryset(searchtable, terms, request.specify_collection)
        related_qss.append(rs.do_search(qs))

    final_result = related_search.final_result(related_qss,
                                               offset=int(request.GET.get('offset', 0)),
                                               limit=int(request.GET.get('limit', 20)))

    return HttpResponse(toJson(final_result), content_type='application/json')

@require_GET
@login_required
def querycbx_search(request, model):
    model = get_model_or_404(model)
    fields = [fieldname
              for fieldname in request.GET
              if fieldname not in ('limit', 'offset')]

    filters = []
    for field in fields:
        filters_for_field = []
        terms = parse_search_str(request.specify_collection, request.GET[field])
        logger.debug("found terms: %s for %s", terms, field)
        for term in terms:
            filter_for_term = term.create_filter(model._meta.get_field(field))
            if filter_for_term is not None:
                filters_for_field.append(filter_for_term)

        logger.debug("filtering %s with %s", field, filters_for_field)
        if len(filters_for_field) > 0:
            filters.append(reduce(or_, filters_for_field))

    if len(filters) > 0:
        combined = reduce(and_, filters)
        qs = filter_by_collection(model.objects.filter(combined), request.specify_collection, strict=False)
    else:
        qs = model.objects.none()

    results = [obj_to_data(obj) for obj in qs[:10]]
    return HttpResponse(toJson(results), content_type='application/json')
