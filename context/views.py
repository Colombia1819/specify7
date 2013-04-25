from django.http import HttpResponse, HttpResponseBadRequest, Http404
from django.views.decorators.http import require_http_methods, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import views as auth_views
from django.utils import simplejson

from specify.models import Collection

from app_resource import get_app_resource
from viewsets import get_view
from schema_localization import get_schema_localization
from specify.views import login_required

def login(request):
    """A Django view to log users into the system.
    Supplements the stock Django login with a collection selection.
    """
    if request.method == 'POST':
        request.session['collection'] = request.POST['collection_id']

    kwargs = {
        'template_name': 'login.html',
        'extra_context': { 'collections': Collection.objects.all() } }
    return auth_views.login(request, **kwargs)

def logout(request):
    """A Django view to log users out."""
    return auth_views.logout(request, template_name='logged_out.html')

@login_required
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def collection(request):
    """Allows the frontend to query or set the logged in collection."""
    if request.method == 'POST':
        try:
            collection = Collection.objects.get(id=int(request.raw_post_data))
        except ValueError:
            return HttpResponseBadRequest('bad collection id', content_type="text/plain")
        except Collection.DoesNotExist:
            return HttpResponseBadRequest('collection does not exist', content_type="text/plain")
        request.session['collection'] = str(collection.id)
        return HttpResponse('ok')
    else:
        collection = request.session.get('collection', '')
        return HttpResponse(collection, content_type="text/plain")

@login_required
@require_GET
def user(request):
    """Return json representation of the currently logged in SpecifyUser."""
    from specify.api import obj_to_data, toJson
    data = obj_to_data(request.specify_user)
    return HttpResponse(toJson(data), content_type='application/json')

@login_required
@require_GET
def domain(request):
    """Return the context hierarchy of the logged in collection."""
    levels = ('collection', 'discipline', 'division', 'institution')
    domain = {}
    obj = type('dummy', (object,), {'collection': request.specify_collection})
    for level in levels:
        obj = getattr(obj, level)
        domain[level] = obj.id

    return HttpResponse(simplejson.dumps(domain), content_type='application/json')

@login_required
@require_GET
def app_resource(request):
    """Return a Specify app resource by name taking into account the logged in user and collection."""
    resource_name = request.GET['name']
    result = get_app_resource(request.specify_collection,
                              request.specify_user,
                              resource_name)
    if result is None: raise Http404()
    resource, mimetype = result
    return HttpResponse(resource, content_type=mimetype)


@require_GET
def available_related_searches(request):
    """Return a list of the available 'related' express searches."""
    import express_search.related_searches
    return HttpResponse(simplejson.dumps(express_search.related_searches.__all__),
                        content_type='application/json')

@require_GET
@login_required
def schema_localization(request):
    """Return the schema localization information for the logged in collection."""
    sl = get_schema_localization(request.specify_collection)
    return HttpResponse(sl, content_type='application/json')

@require_GET
@login_required
def view(request):
    """Return a Specify view definition by name taking into account the logged in user and collection."""
    if 'collectionid' in request.GET:
        # Allow a URL parameter to override the logged in collection.
        collection = Collection.objects.get(id=request.GET['collectionid'])
    else:
        collection = request.specify_collection

    data = get_view(collection, request.specify_user, request.GET['name'])

    return HttpResponse(simplejson.dumps(data), content_type="application/json")
