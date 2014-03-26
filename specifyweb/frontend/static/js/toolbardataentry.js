define([
    'require', 'jquery', 'underscore', 'backbone', 'schema', 'navigation',
    'icons', 'specifyform', 'whenall', 'populateform', 'savebutton',
    'deletebutton', 'appresource', 'jquery-ui', 'jquery-bbq'
], function(require, $, _, Backbone, schema, navigation, icons, specifyform,
            whenAll, populateform, SaveButton, DeleteButton, getAppResource) {
    "use strict";

    var dialog;
    var commonDialogOpts = {
        modal: true,
        close: function() { dialog = null; $(this).remove(); }
    };

    var formsList = getAppResource('DataEntryTaskInit');

    var RecordSetsDialog = Backbone.View.extend({
        __name__: "RecordSetsDialog",
        className: "recordsets-dialog list-dialog",
        events: {
            'click a.edit': 'edit'
        },
        render: function() {
            var ul = $('<ul>');
            var makeEntry = this.dialogEntry.bind(this);
            this.options.recordSets.each(function(recordSet) {
                ul.append(makeEntry(recordSet));
            });
            this.options.recordSets.isComplete() || ul.append('<li>(list truncated)</li>');
            this.$el.append(ul);
            this.$el.dialog(_.extend({}, commonDialogOpts, {
                title: "Record Sets",
                maxHeight: 400,
                buttons: this.buttons()
            }));
            return this;
        },
        dialogEntry: function(recordSet) {
            var img = $('<img>', { src: schema.getModelById(recordSet.get('dbtableid')).getIcon() });
            var entry = $('<li>').append(
                $('<a>', { href: "/specify/recordset/" + recordSet.id + "/" })
                    .addClass("intercept-navigation")
                    .text(recordSet.get('name'))
                    .prepend(img)
                    .append('<span class="item-count" style="display:none"> - </span>'));

            this.options.readOnly || entry.append(
                '<a class="edit"><span class="ui-icon ui-icon-pencil">edit</span></a></li>');

            recordSet.get('remarks') && entry.find('a').attr('title', recordSet.get('remarks'));
            recordSet.getRelatedObjectCount('recordsetitems').done(function(count) {
                $('.item-count', entry).append(count).show();
            });
            return entry;
        },
        buttons: function() {
            var buttons = this.options.readOnly ? [] : [
                    { text: 'New', click: function() { $(this).prop('disabled', true); openFormsDialog(); }}
            ];
            buttons.push({ text: 'Cancel', click: function() { $(this).dialog('close'); }});
            return buttons;
        },
        getIndex: function(evt, selector) {
            evt.preventDefault();
            return this.$(selector).index(evt.currentTarget);
        },
        edit: function(evt) {
            var index = this.getIndex(evt, 'a.edit');
            this.$el.dialog('close');
            dialog = new EditRecordSetDialog({ recordset: this.options.recordSets.at(index) });
            $('body').append(dialog.el);
            dialog.render();
        }
    });

    var FormsDialog = Backbone.View.extend({
        __name__: "FormsDialog",
        className: "forms-dialog list-dialog",
        events: {'click a': 'selected'},
        render: function() {
            var ul = $('<ul>');
            _.each(this.options.views, function(view) {
                var icon = icons.getIcon(view.attr('iconname'));
                ul.append(dialogEntry({ icon: icon, href: '', name: view.attr('title') }));
            });
            ul.find('a.edit').remove();
            this.$el.append(ul);
            this.$el.dialog(_.extend({}, commonDialogOpts, {
                title: "Forms",
                maxHeight: 400,
                buttons: [{ text: 'Cancel', click: function() { $(this).dialog('close'); } }]
            }));
            return this;
        },
        selected: function(evt) {
            var index = this.$('a').index(evt.currentTarget);
            this.$el.dialog('close');
            var form = this.options.forms[index];
            var recordset = new schema.models.RecordSet.Resource();
            var model = schema.getModel(form['class'].split('.').pop());
            recordset.set('dbtableid', model.tableId);
            recordset.set('type', 0);
            dialog = new EditRecordSetDialog({ recordset: recordset });
            $('body').append(dialog.el);
            dialog.render();
        }
    });

    function openFormsDialog() {
        formsList.done(function(views) {
            views = _.map($('view', views), $);
            whenAll(_.map(views, function(view) {
                return specifyform.getView(view.attr('view')).pipe(function(form) { return form; });
            })).done(function(forms) {
                dialog && dialog.$el.dialog('close');
                dialog = new FormsDialog({ views: views, forms: forms });
                $('body').append(dialog.el);
                dialog.render();
            });
        });
    }

    var EditRecordSetDialog = Backbone.View.extend({
        __name__: "EditRecordSetDialog",
        className: "recordset-edit-dialog",
        initialize: function(options) {
            this.recordset = options.recordset;
            this.model = schema.getModelById(this.recordset.get('dbtableid'));
        },
        render: function() {
            var _this = this;

            specifyform.buildViewByName('RecordSet').done(function(form) {
                form.find('.specify-form-header:first').remove();

                if (!_this.readOnly) {
                    var saveButton = new SaveButton({ model: _this.recordset });
                    saveButton.render().$el.appendTo(form);
                    saveButton.on('savecomplete', function() {
                        // TODO: got to be a better way to get the url
                        var url = $.param.querystring(new _this.model.Resource().viewUrl(),
                                                      {recordsetid: _this.recordset.id});
                        navigation.go(url);
                    });
                }

                var title = (_this.recordset.isNew() ? "New " : "") + _this.recordset.specifyModel.getLocalizedName();

                if (!_this.recordset.isNew() && !_this.readOnly) {
                    var deleteButton = new DeleteButton({ model: _this.recordset });
                    deleteButton.render().$el.appendTo(form);
                    deleteButton.on('deleted', function() {
                        dialog.$el.dialog('close');
                        dialog = null;
                    });
                }

                populateform(form, _this.recordset);

                _this.$el.append(form).dialog(_.extend({}, commonDialogOpts, {
                        width: 'auto',
                        title: title
                }));

            });
            return this;
        }
    });

    return {
        task: 'data',
        title: 'Data',
        icon: '/images/Data_Entry.png',
        execute: function() {
            if (dialog) return;
            var app = require('specifyapp');
            var recordSets = new schema.models.RecordSet.LazyCollection();
            recordSets.fetch({ limit: 100 }) // That's a lot of record sets
                .done(function() {
                    dialog = new RecordSetsDialog({ recordSets: recordSets, readOnly: app.isReadOnly });
                    $('body').append(dialog.el);
                    dialog.render();
                });
        }
    };
});
