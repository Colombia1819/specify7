from django.conf.urls import patterns
from django.views.generic import TemplateView
from django.contrib.auth.decorators import login_required


# just send the form.html webapp container for _all_ URLs.
# the webapp (in specifyapp.js) will interpret them
urlpatterns = patterns(
    '',
    (r'', login_required(TemplateView.as_view(template_name="form.html"))),
)
