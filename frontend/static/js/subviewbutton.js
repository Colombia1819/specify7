define([
    'require', 'jquery', 'backbone', 'icons', 'specifyform', 'navigation', 'cs!deletebutton', 'recordselector', 'jquery-bbq'
], function(require, $, Backbone, icons, specifyform, navigation, DeleteButton, RecordSelector) {

    var Base =  Backbone.View.extend({
        __name__: "SubviewButton",
        events: {
            'click a': 'clicked'
        },
        initialize: function(options) {
            var self = this;
            self.field = options.field;
            self.relatedModel = self.field.getRelatedModel();

            self.related = self.options.model || self.options.collection;
            self.model = self.options.parentResource || self.options.collection.parent;

            var props = specifyform.parseSpecifyProperties(self.$el.data('specify-initialize'));
            self.icon = props.icon ? icons.getIcon(props.icon) : self.relatedModel.getIcon();
        },
        render: function() {
            var self = this;
            self.readOnly = specifyform.subViewMode(self.$el) === 'view';
            self.$el.empty();

            var button = $('<a>').appendTo(self.el);

            $('<div style="display: table-row">')
                .append($('<img>', {'class': "specify-subviewbutton-icon", src: self.icon}))
                .append('<span class="specify-subview-button-count">')
                .appendTo(button);

            button.button();
        },
        setCount: function (c) {
            this.$('.specify-subview-button-count').text(c);
        },
        clicked: function(evt) {
            evt.preventDefault();
            if (this.dialog) {
                this.dialog.dialog('close');
            } else {
                this.openDialog();
            }
        }
    });

    var ToMany = Base.extend({
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
        openDialog: function() {
            var self = this;
            if (self.readOnly && self.collection.length < 1) return;

            specifyform.buildSubView(self.$el).done(function(form) {
                var recordSelector = new RecordSelector({
                    field: self.field,
                    collection: self.collection,
                    form: form,
                    readOnly: self.readOnly,
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
    });

    var ToOne = Base.extend({
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
        openDialog: function() {
            var self = this;
            if (self.readOnly && !self.related) return;

            specifyform.buildSubView(self.$el).done(function(dialogForm) {
                self.buildDialog(dialogForm);
            });
        },
        buildDialog: function(dialogForm) {
            var self = this;
            var formReadOnly = specifyform.getFormMode(dialogForm) === 'view';

            dialogForm.find('.specify-form-header:first').remove();

            if (!self.related) {
                if (formReadOnly) return;
                self.related = new (self.model.constructor.forModel(self.relatedModel))();
                self.related.placeInSameHierarchy(self.model);
                self.model.set(self.field.name, self.related);
                self.resourceChanged();
            }

            // $('<input type="button" value="Done">').appendTo(dialogForm).click(function() {
            //     self.dialog.dialog('close');
            // });

            var title = (self.related.isNew() ? "New " : "") + self.relatedModel.getLocalizedName();

            if (!self.readOnly) {
                $('<input type="button" value="Remove">').appendTo(dialogForm).click(function() {
                    self.dialog.dialog('close');
                    self.related = null;
                    self.model.set(self.field.name, self.related);
                    self.resourceChanged();
                });
            }

            require("cs!populateform")(dialogForm, self.related);
            var link = '<a href="' + self.related.viewUrl() + '"><span class="ui-icon ui-icon-link">link</span></a>';
            self.dialog = $('<div>').append(dialogForm).dialog({
                width: 'auto',
                title: title,
                close: function() { $(this).remove(); self.dialog = null; }
            });

            // TODO: this was copied from querycbx. should factor out somehow.
            if (!self.related.isNew() && !self.field.isDependent()) {
                self.dialog.closest('.ui-dialog').find('.ui-dialog-titlebar:first').prepend(
                    '<a href="' + self.related.viewUrl() + '"><span class="ui-icon ui-icon-link">link</span></a>');

                self.dialog.parent().delegate('.ui-dialog-title a', 'click', function(evt) {
                    evt.preventDefault();
                    navigation.go(self.related.viewUrl());
                    self.dialog.dialog('close');
                });
            }
        }
    });

    return {
        ToMany: ToMany,
        ToOne: ToOne,
        Attachments: ToMany
    };
});
