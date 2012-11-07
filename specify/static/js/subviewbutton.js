define([
    'jquery', 'backbone', 'icons', 'specifyform', 'navigation', 'cs!deletebutton', 'recordselector', 'jquery-bbq'
], function($, Backbone, icons, specifyform, navigation, DeleteButton, RecordSelector) {

    var Base =  Backbone.View.extend({
        events: {
            'click a': 'openDialog'
        },
        initialize: function(options) {
            var self = this;
            self.field = options.field;
            self.relatedModel = self.field.getRelatedModel();

            self.related = self.options.model;
            self.model = self.options.parentResource;

            var props = specifyform.parseSpecifyProperties(self.$el.data('specify-initialize'));
            self.icon = props.icon ? icons.getIcon(props.icon) : self.relatedModel.getIcon();
        },
        render: function() {
            var self = this;
            self.$el.empty();

            var button = $('<a>').appendTo(self.el);

            $('<div style="display: table-row">')
                .append($('<img>', {'class': "specify-subviewbutton-icon", src: self.icon}))
                .append('<span class="specify-subview-button-count">')
                .appendTo(button);
            button.button({ disabled: self.model.isNew() });
        },
        setCount: function (c) {
            this.$('.specify-subview-button-count').text(c);
        }
    });

    return {
        ToMany: Base.extend({
            initialize: function(options) {
                Base.prototype.initialize.call(this, options);
                this.collection.on('add remove destroy', this.collectionChanged, this);
            },
            render: function() {
                Base.prototype.render.apply(this, arguments);
                this.collectionChanged();
            },
            collectionChanged: function() {
                this.setCount(this.collection.length);
                if (this.collection.length < 1 && this.dialog) this.dialog.dialog('close');
            },
            openDialog: function(evt) {
                evt.preventDefault();
                var self = this;
                if (self.dialog) return;

                specifyform.buildSubView(self.$el).done(function(form) {
                    var recordSelector = new RecordSelector({
                        field: self.field,
                        collection: self.collection,
                        populateform: self.options.populateform,
                        form: form,
                        noHeader: true
                    });
                    recordSelector.render();
                    if (self.collection.length < 1) recordSelector.add();

                    self.dialog = $('<div>').append(recordSelector.el).dialog({
                        width: 'auto',
                        title: self.field.getLocalizedName(),
                        close: function() { $(this).remove(); self.dialog = null; }
                    });
                });
            }
        }),

        ToOne: Base.extend({
            initialize: function(options) {
                Base.prototype.initialize.call(this, options);
                this.model.on('change:' + this.field.name.toLowerCase(), this.resourceChanged, this);
            },
            render: function() {
                Base.prototype.render.apply(this, arguments);
                this.resourceChanged();
            },
            resourceChanged: function() {
                this.setCount(this.model.get(this.field.name) ? 1 : 0);
            },
            openDialog: function(evt) {
                evt.preventDefault();
                var self = this;
                specifyform.buildSubView(self.$el).done(function(dialogForm) {

                    dialogForm.find('.specify-form-header:first').remove();

                    if (!self.related) {
                        self.related = new (self.model.constructor.forModel(self.relatedModel))();
                        self.related.placeInSameHierarchy(self.model);
                        self.model.setToOneField(self.field.name, self.related);
                        self.resourceChanged();
                    }

                    $('<input type="button" value="Done">').appendTo(dialogForm).click(function() {
                        dialog.dialog('close');
                    });

                    var title = (self.related.isNew() ? "New " : "") + self.relatedModel.getLocalizedName();

                    if (self.related.isNew()) {
                        $('<input type="button" value="Remove">').appendTo(dialogForm).click(function() {
                            dialog.dialog('close');
                            self.related = null;
                            self.model.setToOneField(self.field.name, self.related, {silent: true});
                            self.resourceChanged();
                        });
                    } else {
                        var deleteButton = new DeleteButton({ model: self.related });
                        deleteButton.render().$el.appendTo(dialogForm);
                        deleteButton.on('deleted', function() {
                            dialog.dialog('close');
                            self.related = null;
                            self.model.setToOneField(self.field.name, self.related, {silent: true});
                            self.resourceChanged();
                        });

                        title = '<a href="' + self.related.viewUrl() + '"><span class="ui-icon ui-icon-link">link</span></a>'
                            + title;
                    }

                    self.options.populateform(dialogForm, self.related);
                    var link = '<a href="' + self.related.viewUrl() + '"><span class="ui-icon ui-icon-link">link</span></a>'
                    var dialog = $('<div>').append(dialogForm).dialog({
                        width: 'auto',
                        title: title,
                        close: function() { $(this).remove(); }
                    });
                });
            }
        })
    };
});
