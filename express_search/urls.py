from django.conf.urls import patterns, include, url

urlpatterns = patterns(
    'express_search.views',
    url(r'^$', 'search'),
    url(r'^related/$', 'related_search'),
    url(r'^querycbx/(?P<model>\w*)/$', 'querycbx_search'),
)


