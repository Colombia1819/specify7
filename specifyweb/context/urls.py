from django.conf.urls import patterns

urlpatterns = patterns(
    'context.views',
    (r'^login/$', 'api_login'),
    (r'^collection/$', 'collection'),
    (r'^user.json$', 'user'),
    (r'^domain.json$', 'domain'),
    (r'^view.json$', 'view'),
    (r'^schema_localization.json$', 'schema_localization'),
    (r'^app.resource$', 'app_resource'),
    (r'^available_related_searches.json$', 'available_related_searches'),
    (r'^attachment_settings.json$', 'attachment_settings')
)
