define([
    'jquery', 'underscore', 'backbone', 'schema', 'queryfield', 'templates',
    'cs!fieldformat', 'dataobjformatters',
    'cs!savebutton', 'whenall', 'scrollresults',
    'jquery-bbq', 'jquery-ui'
], function($, _, Backbone, schema, QueryFieldUI, templates,
            fieldformat, dataobjformatters, SaveButton, whenAll, ScrollResults) {
    "use strict";
    var objformat = dataobjformatters.format, aggregate = dataobjformatters.aggregate;

    var Results = Backbone.View.extend({
        __name__: "QueryResultsView",
        initialize: function(options) {
            this.fieldUIs = options.fieldUIs;
            this.model = options.model;
        },
        detectEndOfResults: function(results) {
            return results.length < 2;
        },
        addResults: function(results) {
            var self = this;
            var columns = results.shift();
            var fieldToCol = function(fieldUI) {
                return _(columns).indexOf(fieldUI.spqueryfield.id);
            };

            _.each(results, function(result) {
                var row = $('<tr>').appendTo(self.el);
                var resource = new self.model.Resource({
                    id: result[0]
                });
                var href = resource.viewUrl();
                _.each(self.fieldUIs, function(fieldUI) {
                    if (!fieldUI.spqueryfield.get('isdisplay')) return;
                    var value = result[fieldToCol(fieldUI)];
                    self.makeCell(href, fieldUI, value).appendTo(
                        $('<td>').appendTo(row));
                });
            });
            return results.length;
        },
        makeCell: function(rowHref, cellFieldUI, cellValue) {
            var field = cellFieldUI.getField();
            var cell = $('<a class="intercept-navigation query-result">')
                    .prop('href', rowHref);

            if (cellFieldUI.formattedRecord) {
                (field.type === 'many-to-one') ?
                    this.setupToOneCell(cell, field, cellValue) :
                    this.setupToManyCell(cell, field, cellValue);
            } else {
                field && ( cellValue = fieldformat(field, cellValue) );
                cell.text(cellValue);
            }
            return cell;
        },
        setupToOneCell: function(cell, field, cellValue) {
            var resource = new (field.getRelatedModel().Resource)({ id: cellValue });
            cell.prop('href', resource.viewUrl()).text('(loading...)');
            objformat(resource).done(function(formatted) { cell.text(formatted); });
        },
        setupToManyCell: function(cell, field, cellValue) {
            cell.text('(loading...)');
            var parentResource = new field.model.Resource({ id: cellValue });
            parentResource.rget(field.name, true).pipe(aggregate).done(function(formatted) {
                cell.text(formatted);
            });
        }
    });

    var StoredQueryView = Backbone.View.extend({
        __name__: "QueryBuilder",
        events: {
            'click .query-execute': 'search',
            'click .field-add': 'addField',
            'click .abandon-changes': function() { this.trigger('redisplay'); }
        },
        initialize: function(options) {
            var self = this;
            self.query = options.query;
            self.model = schema.getModel(self.query.get('contextname'));
            self.saveButton = new SaveButton({ model: self.query });
            self.saveButton.on('savecomplete', function() { this.trigger('redisplay'); }, this);
        },
        render: function() {
            var self = this;
            $('<h2 class="querybuilder-header">')
                .text('Query: ' + self.query.get('name'))
                .prepend($('<img>', {src: self.model.getIcon()}))
                .appendTo(self.el);
            self.$el.append(templates.querybuilder());
            self.$('.querybuilder').append(self.saveButton.render().el);

            self.$('button.field-add').button({
                icons: { primary: 'ui-icon-plus' }, text: false
            });

            self.query.on('saverequired', this.saveRequired, this);

            self.query.rget('fields', true).done(function(spqueryfields) {
                self.fields = spqueryfields;
                self.fieldUIs = spqueryfields.map(function(spqueryfield) {
                    var ui = new QueryFieldUI({
                        parentView: self,
                        model: self.model,
                        spqueryfield: spqueryfield,
                        el: $('<li class="spqueryfield">')
                    });
                    ui.on('remove', function(ui, field) { self.fields.remove(field); });
                    return ui.render();
                });

                var ul = self.$('.spqueryfields');
                ul.append.apply(ul, _.pluck(self.fieldUIs, 'el'));
            });

            $('<table class="query-results" width="100%"></div>').appendTo(self.el);
            self.$el.append(
                '<div style="text-align: center" class="fetching-more"><img src="/static/img/specify128spinner.gif"></div>');
            self.$('.fetching-more').hide();
            return self;
        },
        saveRequired: function() {
            this.$('.query-execute').prop('disabled', true);
            this.$('.abandon-changes').prop('disabled', false);
        },
        addField: function() {
            var newField = new schema.models.SpQueryField.Resource();
            newField.set({sorttype: 0, isdisplay: true, query: this.query.url()});

            var addFieldUI = new QueryFieldUI({
                parentView: this,
                model: this.model,
                el: $('<li class="spqueryfield">'),
                spqueryfield: newField
            });
            this.$('.spqueryfields').append(addFieldUI.render().el);
            addFieldUI.on('completed', function() { this.fields.add(newField); }, this);
            this.trigger('positionschanged');
        },
        renderHeader: function() {
            var header = $('<tr>');
            _.each(this.fieldUIs, function(fieldUI) {
                if (!fieldUI.spqueryfield.get('isdisplay')) return;
                var field = fieldUI.getField();
                var icon = field.model.getIcon();
                var name = fieldUI.treeRank || field.getLocalizedName();
                fieldUI.datePart && ( name += ' (' + fieldUI.datePart + ')' );
                $('<th>').text(name).prepend($('<img>', {src: icon})).appendTo(header);
            });
            return header;
        },
        search: function(evt) {
            var self = this;
            var table = self.$('table.query-results');

            table.empty();
            table.append(self.renderHeader());

            var ajaxUrl = "/stored_query/query/" + self.query.id + "/";
            var view = new ScrollResults({
                View: Results,
                el: table,
                viewOptions: {fieldUIs: self.fieldUIs, model: self.model},
                ajaxUrl: ajaxUrl
            }).render()
                .on('fetching', function() { this.$('.fetching-more').show(); }, this)
                .on('gotdata', function() { this.$('.fetching-more').hide(); }, this);

            view.fetchMoreWhileAppropriate();
        },
        moveUp: function(queryField) {
            queryField.$el.prev().insertAfter(queryField.el);
            this.trigger('positionschanged');
        },
        moveDown: function(queryField) {
            queryField.$el.next().insertBefore(queryField.el);
            this.trigger('positionschanged');
        }
    });

    return function(app) {
        app.router.route('query/:id/', 'storedQuery', function(id) {
            function doIt() {
                var query = new schema.models.SpQuery.Resource({ id: id });
                query.fetch().fail(app.handleError).done(function() {
                    app.setCurrentView(new StoredQueryView({ query: query }));
                    app.getCurrentView().on('redisplay', doIt);
                });
            }
            doIt();
        });
    };
});
