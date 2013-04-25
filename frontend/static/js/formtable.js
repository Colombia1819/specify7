define([
    'jquery', 'underscore', 'backbone', 'specifyform', 'templates', 'cs!savebutton', 'cs!deletebutton'
], function($, _, Backbone, specifyform, templates, SaveButton, DeleteButton) {

    return Backbone.View.extend({
        events: {
            'click a.specify-edit, a.specify-display': 'edit',
            'click .specify-subview-header a.specify-add-related': 'add'
        },
        initialize: function(options) {
            this.field = this.options.field;
            if (this.field && !this.collection.parent)
                throw new Error('collection for field does not have parent resource');

            this.title = this.field ? this.field.getLocalizedName() : this.collection.model.specifyModel.getLocalizedName();

            this.collection.on('add', this.render, this);
            this.collection.on('remove destroy', this.render, this);

            this.readOnly = specifyform.getFormMode(this.options.form) === 'view';
        },
        render: function() {
            var self = this;
            var header = $(templates.subviewheader());

            header.find('.specify-delete-related, .specify-visit-related').remove();
            if (self.readOnly) header.find('.specify-add-related').remove();
            self.$el.empty().append(header);
            self.$('.specify-subview-title').text(self.title);

            if (self.collection.length < 1) {
                self.$el.append('<p>nothing here...</p>');
                return;
            }

            var rows = self.collection.map(function(resource, index) {
                var form = self.options.form.clone();
                var url = resource.viewUrl();
                $('a.specify-' + (self.readOnly ? 'edit' : 'display'), form).remove();
                $('a.specify-edit, a.specify-display', form).data('index', index);
                return self.options.populateform(form, resource);
            });

            self.$el.append(rows[0]);
            _(rows).chain().tail().each(function(row) {
                self.$('.specify-view-content-container:first').append($('.specify-view-content:first', row));
            });
        },
        edit: function(evt) {
            evt.preventDefault();
            var index = $(evt.currentTarget).data('index');
            this.buildDialog(this.collection.at(index));
        },
        buildDialog: function(resource) {
            var self = this;
            var mode = self.readOnly ? 'view' : 'edit';
            specifyform.buildViewByName(resource.specifyModel.view, null, mode).done(function(dialogForm) {
                var readOnly = specifyform.getFormMode(dialogForm) === 'view';

                dialogForm.find('.specify-form-header:first').remove();

                if (readOnly) {
                    // don't add anything.
                } else if (self.collection.dependent) {
                    $('<input type="button" value="Done">').appendTo(dialogForm).click(function() {
                        dialog.dialog('close');
                    });
                    $('<input type="button" value="Remove">').appendTo(dialogForm).click(function() {
                        self.collection.remove(resource);
                        dialog.dialog('close');
                    });
                } else {
                    var saveButton = new SaveButton({ model: resource });
                    saveButton.render().$el.appendTo(dialogForm);
                    saveButton.on('savecomplete', function() {
                        dialog.dialog('close');
                        self.collection.add(resource);
                    });

                    if (!resource.isNew()) {
                        var deleteButton = new DeleteButton({ model: resource });
                        deleteButton.render().$el.appendTo(dialogForm);
                        deleteButton.on('deleted', function() { dialog.dialog('close'); });
                    }
                }

                self.options.populateform(dialogForm, resource);

                var dialog = $('<div>').append(dialogForm).dialog({
                    width: 'auto',
                    title: (resource.isNew() ? "New " : "") + resource.specifyModel.getLocalizedName(),
                    close: function() { $(this).remove(); }
                });
            });
        },
        add: function(evt) {
            var self = this;
            evt.preventDefault();

            var newResource = new (self.collection.model)();
            if (self.field) {
                newResource.set(self.field.otherSideName, self.collection.parent.url());
            }
            self.collection.dependent && self.collection.add(newResource);

            self.buildDialog(newResource);
        }
    });
});
