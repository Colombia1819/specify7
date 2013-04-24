define([
    'require', 'jquery', 'underscore', 'backbone', 'schema', 'specifyapi', 'navigation',
    'specifyform', 'cs!populateform', 'cs!savebutton', 'cs!deletebutton',
    'text!resources/querybuilder.xml!noinline',
    'jquery-ui'
], function(require, $, _, Backbone, schema, api, navigation,
            specifyform, populateform, SaveButton, DeleteButton,
            querybuilderXML) {
    "use strict";
    var qbDef = $.parseXML(querybuilderXML);

    var title = "Query";

    var dialog;
    var commonDialogOpts = {
        modal: true,
        close: function() { dialog = null; $(this).remove(); }
    };

    var dialogEntry = _.template('<li><a class="select" <%= href %>><img src="<%= icon %>"><%= name %></a>'
                                 + '<a class="edit"><span class="ui-icon ui-icon-pencil">edit</span></a></li>');

    var dialogView = Backbone.View.extend({
        className: "stored-queries-dialog list-dialog",
        events: {
            'click a.select': 'selected',
            'click a.edit': 'edit'
        },
        render: function() {
            var ul = $('<ul>');
            this.options.queries.each(function(query) {
                var icon = schema.getModelById(query.get('contexttableid')).getIcon();
                var href = 'href="/specify/query/' + query.id + '/"';
                var entry = $(dialogEntry({ icon: icon, href: href, name: query.get('name') }));
                query.get('remarks') && entry.find('a').attr('title', query.get('remarks'));
                ul.append(entry);
            });
            this.$el.append(ul);
            this.$el.dialog(_.extend({}, commonDialogOpts, {
                title: title,
                maxHeight: 400,
                buttons: [
                    {text: 'New', click: function(evt) { $(evt.target).prop('disabled', true); openQueryTypeDialog(); }},
                    {text: 'Cancel', click: function() { $(this).dialog('close'); }}
                ]
            }));
            return this;
        },
        selected: function(evt) {
            evt.preventDefault();
            var index = this.$('a.select').index(evt.currentTarget);
            var queryId = this.options.queries.at(index).id;
            navigation.go('/query/' + queryId + '/');
        },
        edit: function(evt) {
            evt.preventDefault();
            this.$el.dialog('close');
            var index = this.$('a.edit').index(evt.currentTarget);
            dialog = new EditQueryDialog({ spquery: this.options.queries.at(index) });
            $('body').append(dialog.el);
            dialog.render();
        }
    });

    function openQueryTypeDialog() {
        dialog && dialog.$el.dialog('close');
        var tables = _.map($('database > table', qbDef), $);
        dialog = new QueryTypeDialog({ tables: tables });
        $('body').append(dialog.el);
        dialog.render();
    }

    var QueryTypeDialog = Backbone.View.extend({
        className: "query-type-dialog list-dialog",
        events: {'click a.select': 'selected'},
        render: function() {
            var ul = $('<ul>');
            _.each(this.options.tables, function(table) {
                var model = schema.getModel(table.attr('name'));
                ul.append(dialogEntry({ icon: model.getIcon(), href: '', name: model.getLocalizedName() }));
            });
            ul.find('a.edit').remove();
            this.$el.append(ul);
            this.$el.dialog(_.extend({}, commonDialogOpts, {
                title: "New Query Type",
                maxHeight: 400,
                buttons: [{ text: 'Cancel', click: function() { $(this).dialog('close'); } }]
            }));
            return this;
        },
        selected: function(evt) {
            var app = require('specifyapp');
            var index = this.$('a.select').index(evt.currentTarget);
            this.$el.dialog('close');
            var table = this.options.tables[index];
            var query = new (api.Resource.forModel('spquery'))();

            var model = schema.getModel(table.attr('name'));
            query.set('contextname', model.name);
            query.set('contexttableid', model.tableId);
            query.set('specifyuser', app.user.resource_uri);
            dialog = new EditQueryDialog({ spquery: query });
            $('body').append(dialog.el);
            dialog.render();
        }
    });


    var EditQueryDialog = Backbone.View.extend({
        className: "query-edit-dialog",
        initialize: function(options) {
            this.spquery = options.spquery;
            this.model = schema.getModelById(this.spquery.get('contexttableid'));
        },
        render: function() {
            var _this = this;

            specifyform.buildViewByName('Query').done(function(form) {
                form.find('.specify-form-header:first').remove();

                if (!_this.readOnly) {
                    var saveButton = new SaveButton({ model: _this.spquery });
                    saveButton.render().$el.appendTo(form);
                    saveButton.on('savecomplete', function() {
                        navigation.go('/query/' + _this.spquery.id + '/');
                    });
                }

                var title = (_this.spquery.isNew() ? "New " : "") + _this.spquery.specifyModel.getLocalizedName();

                if (!_this.spquery.isNew() && !_this.readOnly) {
                    var deleteButton = new DeleteButton({ model: _this.spquery });
                    deleteButton.render().$el.appendTo(form);
                    deleteButton.on('deleted', function() {
                        dialog.$el.dialog('close');
                        dialog = null;
                    });
                }

                populateform(form, _this.spquery);

                _this.$el.append(form).dialog(_.extend({}, commonDialogOpts, {
                        width: 'auto',
                        title: title,
                        close: function() { $(this).remove(); dialog = null; }
                }));
            });
            return this;
        }
    });

    return {
        title: title,
        icon: '/images/Query32x32.png',
        execute: function() {
            if (dialog) return;
            var queries = new (api.Collection.forModel('spquery'))();
            queries.fetch().done(function() {
                dialog = new dialogView({ queries: queries });
                $('body').append(dialog.el);
                dialog.render();
            });
        }
    };
});