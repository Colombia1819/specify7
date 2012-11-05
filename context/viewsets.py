"""
Provides a view that returns the appropriate viewset for a given context
hierarchy level. Depends on the user and logged in collectien of the request.
"""
import os
from xml.etree import ElementTree

from django.http import HttpResponse, Http404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET
from django.utils import simplejson

from specify.models import Spappresourcedata, Specifyuser, Collection

import app_resource as AR

@require_GET
@login_required
def view(request):
    if 'collectionid' in request.GET:
        collection = Collection.objects.get(id=request.GET['collectionid'])
    else:
        collection = request.specify_collection

    data = get_view(collection, request.specify_user, request.GET['name'])

    return HttpResponse(simplejson.dumps(data), content_type="application/json")

def get_view(collection, user, viewname):

    matches = ((viewset, view, src, level)
               for get_viewsets, src in ((get_viewsets_from_db, 'db'), (load_viewsets, 'disk'))
               for level in AR.DIR_LEVELS
               for viewset in get_viewsets(collection, user, level)
               for view in viewset.findall('views/view[@name="%s"]' % viewname))
    try:
        viewset, view, source, level = matches.next()
    except StopIteration:
        raise Http404("view: %s not found" % viewname)

    altviews = view.findall('altviews/altview')

    viewdefs = set((viewdef
                    for altview in altviews
                    for viewdef in viewset.findall('viewdefs/viewdef[@name="%s"]' % altview.attrib['viewdef'])))

    def get_definition(viewdef):
        definition = viewdef.find('definition')
        if definition is None: return
        definition_viewdef = viewset.find('viewdefs/viewdef[@name="%s"]' % definition.text)
        if definition_viewdef is None:
            raise Http404("no viewdef: %s for definition of viewdef: %s" % (
                    definition.text, viewdef.attrib['name']))
        return definition_viewdef

    viewdefs.update(filter(None, [get_definition(viewdef) for viewdef in viewdefs]))

    data = view.attrib.copy()
    data['altviews'] = dict((altview.attrib['name'], altview.attrib.copy())
                            for altview in altviews)

    data['viewdefs'] = dict((viewdef.attrib['name'], ElementTree.tostring(viewdef))
                            for viewdef in viewdefs)

    data['viewsetName'] = viewset.attrib['name']
    data['viewsetLevel'] = level
    data['viewSetSource'] = source
    return data

def get_viewsets_from_db(collection, user, level):
    """Try to get a viewset at a particular level in the given context from the database."""
    # The context directory structure for the viewset system is the same as for
    # the app resources, so we can use the same function to find the appropriate
    # SpAppResourceDirs to join against.
    dirs = AR.get_app_resource_dirs_for_level(collection, user, level)

    # Pull out all the SpAppResourceDatas that have an associated SpViewsetObj in
    # the SpAppResourceDirs we just found.
    objs = Spappresourcedata.objects.filter(spviewsetobj__spappresourcedir__in=dirs)
    return (ElementTree.XML(o.data) for o in objs)

def load_viewsets(collection, user, level):
    """Try to get a viewset for a given level and context from the filesystem."""
    # The directory structure for viewsets are the same as for app resources.
    path = AR.get_path_for_level(collection, user, level)
    if not path: return []

    # The viewset registry lists all the viewset files for that directory.
    registry = AR.load_registry(path, 'viewset_registry.xml')

    # Load them all.
    return (get_viewset_from_file(path, f.attrib['file'])
            for f in registry.findall('file'))

def get_viewset_from_file(path, filename):
    """Just load the XML for a viewset from path and pull out the root."""
    return ElementTree.parse(os.path.join(path, filename)).getroot()

