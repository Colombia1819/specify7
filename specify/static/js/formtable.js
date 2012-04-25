define([
    'require', 'jquery', 'underscore', 'backbone', 'populateform', 'schemalocalization', 'specifyform',
    'text!/static/html/templates/subviewheader.html'
], function(require, $, _, Backbone, populateform, schemalocalization, specifyform, subviewheader) {

    return Backbone.View.extend({
        events: {
            'click a.specify-edit': 'edit'
        },
        initialize: function(options) {
            this.resource = options.resource;
            this.specifyModel = options.resource.specifyModel;
            this.fieldName = options.fieldName;
            this.title = schemalocalization.getLocalizedLabelForField(this.fieldName, this.specifyModel);
        },
        render: function() {
            var self = this;
            var populateForm = require('populateform');
            self.undelegateEvents();
            self.$el.empty().append(subviewheader);
            self.$('.specify-subview-title').text(self.title);
            if (self.collection.length < 1) {
                self.$el.append('<p style="text-align: center">nothing here...</p>');
                return;
            }
            var rows = self.collection.map(function(resource) {
                var form = specifyform.buildSubView(self.$el);
                var url = resource.viewUrl();
                $('a.specify-edit', form).prop('href', url)
                    .data('backbone-url', url.replace(/^\/specify/, ''));
                return populateForm(form, resource);
            });
            self.$el.append(rows[0]);
            _(rows).chain().tail().each(function(row) {
                self.$('.specify-view-content-container:first').append($('.specify-view-content:first', row));
            });
            self.delegateEvents();
        },
        edit: function(evt) {
            evt.preventDefault();
            var url = $(evt.currentTarget).data('backbone-url');
            Backbone.history.navigate(url, {trigger: true});
        }
    });
});
