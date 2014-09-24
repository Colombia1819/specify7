define([
    'require', 'jquery', 'underscore', 'backbone', 'schema', 'queryfield', 'parsespecifyproperties',
    'whenall', 'dataobjformatters', 'fieldformat', 'domain',
    'text!context/report_runner_status.json!noinline',
    'jquery-ui', 'jquery-bbq'
], function(
    require, $, _, Backbone, schema, QueryFieldUI, parsespecifyproperties,
    whenAll, dataobjformatters, fieldformat, domain,
    statusJSON
) {
    "use strict";
    var objformat = dataobjformatters.format, aggregate = dataobjformatters.aggregate;

    var app;
    var status = $.parseJSON(statusJSON);
    var title =  "Reports";

    var dialog;
    function makeDialog(el, options) {
        dialog && dialog.dialog('close');
        dialog = el.dialog(_.extend({
            modal: true,
            close: function() { dialog = null; $(this).remove(); }
        }, options));
    }

    var dialogEntry = _.template('<li><a href="#"><img src="<%= icon %>">' +
                                 '<%= name %><span class="item-count" style="display:none"> - </span></a></li>');

    var ReportListDialog = Backbone.View.extend({
        __name__: "ReportListDialog",
        className: "reports-dialog list-dialog",
        events: {
            'click a': 'getReport'
        },
        initialize: function(options) {
            var appResources = this.options.appResources;
            function byType(type) {
                return appResources.filter(function(r) {
                    return r.get('mimetype').toLowerCase() === type;
                });
            }
            this.reports = byType('jrxml/report');
            this.labels = byType('jrxml/label');
        },
        render: function() {
            var reports = $('<ul class="reports">');
            var labels = $('<ul class="labels">');

            reports.append.apply(reports, _.map(this.reports, this.makeEntry.bind(this, "/images/Reports16x16.png")));
            labels.append.apply(labels, _.map(this.labels, this.makeEntry.bind(this, "/images/Label16x16.png")));

            this.$el
                .append("<h2>Reports</h2>").append(reports)
                .append("<h2>Labels</h2>").append(labels);

            this.options.appResources.isComplete() || this.$el.append('<p>(list truncated)</p>');

            makeDialog(this.$el, {
                title: title,
                maxHeight: 400,
                buttons: [
                    {text: 'Cancel', click: function() { $(this).dialog('close'); }}
                ]
            });
            return this;
        },
        makeEntry: function(icon, appResource) {
            var a = $('<a class="select">').text(appResource.get('name'))
                    .prepend($('<img>', {src: icon}))
                    .attr('title', appResource.get('remarks') || "");
            return $('<li>').append(a).data('resource', appResource)
                    .append('<a class="edit ui-icon ui-icon-pencil">edit</a>');
        },
        getReport: function(evt) {
            evt.preventDefault();
            var appResource = $(evt.currentTarget).closest('li').data('resource');
            var reports = new schema.models.SpReport.LazyCollection({
                filters: {
                    specifyuser: app.user.id,
                    appresource: appResource.id
                }
            });
            var dataFetch = appResource.rget('spappresourcedatas', true);

            var action = ($(evt.currentTarget).hasClass('edit') ? this.editReport : this.getRecordSets).bind(this);
            $.when(dataFetch, reports.fetch({ limit: 1 })).done(function(data) {
                if (data.length > 1) {
                    console.warn("found multiple report definitions for appresource id:", resourceId);
                } else if (data.length < 1) {
                    console.error("coundn't find report definition for appresource id:", resourceId);
                    return;
                }
                if (!reports.isComplete()) {
                    console.warn("found multiple report objects for appresource id:", resourceId);
                } else if (reports.length < 1) {
                    console.error("couldn't find report object for appresource id:", resourceId);
                    return;
                }
                reports.at(0).rget('query', true).done(function(query) {
                    var report = reports.at(0);
                    report.XML = data.at(0).get('data');
                    action(appResource, report, query);
                });
            });
        },
        getRecordSets: function(appResource, report, query) {
            var contextTableId = query ? query.get('contexttableid') :
                    parseInt(
                        parsespecifyproperties(appResource.get('metadata')).tableid,
                        10);

            if (_.isNaN(contextTableId) || contextTableId === -1) {
                console.error("couldn't determine table id for report", report.get('name'));
                return;
            }

            var recordSets = new schema.models.RecordSet.LazyCollection({
                filters: {
                    specifyuser: app.user.id,
                    collectionmemberid: domain.levels.collection.id,
                    dbtableid: contextTableId
                }
            });
            recordSets.fetch({ limit: 100 }).done(function() {
                (new ChooseRecordSetDialog({
                    recordSets: recordSets,
                    report: report,
                    query: query
                })).render();
            });
        },
        editReport: function(appResource, report, query) {
            makeDialog($('<div title="Report definition">')
                       .append($('<textarea cols=120 rows=40 readonly>')
                               .text(report.XML)),
                      { width: 'auto'});
        }
    });

    var ChooseRecordSetDialog = Backbone.View.extend({
        __name__: "ChooseRecordSetForReport",
        className: "recordset-for-report-dialog list-dialog",
        events: {
            'click a': 'selected'
        },
        initialize: function(options) {
            this.report = options.report;
            this.query = options.query;
            this.recordSets = options.recordSets;
        },
        render: function() {
            var ul = $('<ul>');
            this.recordSets.each(function(recordSet) {
                var icon = schema.getModelById(recordSet.get('dbtableid')).getIcon();
                var entry = $(dialogEntry({ icon: icon, name: recordSet.get('name') }));
                recordSet.get('remarks') && entry.find('a').attr('title', recordSet.get('remarks'));
                ul.append(entry);
                recordSet.getRelatedObjectCount('recordsetitems').done(function(count) {
                    $('.item-count', entry).append(count).show();
                });
            });
            this.recordSets.isComplete() || ul.append('<li>(list truncated)</li>');
            this.$el.append(ul);
            makeDialog(this.$el, {
                title: "From Record Set",
                maxHeight: 400,
                buttons: this.dialogButtons()
            });
            return this;
        },
        dialogButtons: function() {
            var buttons = [{ text: 'Cancel', click: function() { $(this).dialog('close'); }}];

            if (this.query) {
                var queryParamsDialogOpts = {
                    report: this.report,
                    query: this.query
                };
                buttons.unshift({
                    text: 'Query',
                    click: function() {
                        (new QueryParamsDialog(queryParamsDialogOpts)).render();
                    }
                });
            }
            return buttons;
        },
        selected: function(evt) {
            evt.preventDefault();
            var recordSet = this.recordSets.at(this.$('a').index(evt.currentTarget));
            (new QueryParamsDialog({
                report: this.report,
                query: this.query,
                recordSetId: recordSet.id
            })).runQuery();
        }
    });

    var QueryParamsDialog = Backbone.View.extend({
        __name__: "QueryParamsDialog",
        initialize: function(options) {
            this.report = options.report;
            this.query = options.query;
            this.recordSetId = options.recordSetId;
            this.model = schema.getModel(this.query.get('contextname'));

            var makeFieldUI = (function(spqueryfield) {
                return new QueryFieldUI({
                    forReport: true,
                    parentView: this,
                    model: this.model,
                    spqueryfield: spqueryfield,
                    el: $('<li class="spqueryfield for-report">')
                });
            }).bind(this);

            this.fieldUIsP = this.query.rget('fields').pipe(function(spqueryfields) {
                spqueryfields.each(function(field) { field.set('isdisplay', true); });
                return spqueryfields.map(makeFieldUI);
            });
        },
        render: function() {
            this.$el.append('<ul class="query-params-list">');
            makeDialog(this.$el, {
                    title: this.query.get('name'),
                    width: 800,
                    position: { my: "top", at: "top+20", of: $('body') },
                    buttons: [
                        {text: "Run", click: this.runQuery.bind(this)},
                        {text: "Cancel", click: function() { $(this).dialog('close'); }}
                    ]
            });
            var ul = this.$('ul');
            this.fieldUIsP.done(function(fieldUIs) {
                _.invoke(fieldUIs, 'render');
                ul.append.apply(ul, _.pluck(fieldUIs, 'el'));
            });
            return this;
        },
        runQuery: function() {
            this.fieldUIsP.done(runQuery.bind(null, this.report, this.recordSetId, this.query));
        }
    });


    function runQuery(report, recordSetId, spQuery, fieldUIs) {
        var query = spQuery.toJSON();
        query.limit = 0;
        query.recordsetid = recordSetId;
        $.post('/stored_query/ephemeral/', JSON.stringify(query)).done(runReport.bind(null, report, fieldUIs));
        makeDialog($('<div title="Running query">Running query...</div>'));
    }

    function runReport(report, fieldUIs, queryResults) {
        dialog && dialog.dialog('close');
        if (queryResults.count < 1) {
            makeDialog($('<div title="No results">The query returned no records.</div>'));
            return;
        }
        makeDialog($('<div title="Formatting records">Formatting records...</div>'));
        var fields = ['id'].concat(_.map(fieldUIs, function(fieldUI) { return fieldUI.spqueryfield.get('stringid'); }));
        var reportXML = report.XML;
        formatResults(fieldUIs, queryResults.results).done(function(formattedData) {
            dialog && dialog.dialog('close');
            var reportWindowContext = "ReportWindow" + Math.random();
            window.open("", reportWindowContext);
            var form = $('<form action="/report_runner/run/" method="post" target="' + reportWindowContext + '">' +
                         '<textarea name="report"></textarea>' +
                         '<textarea name="data"></textarea>' +
                         '<input type="submit"/>' +
                         '</form>');

            var reportData = { fields: fields, rows: formattedData };
            $('textarea[name="report"]', form).val(reportXML);
            $('textarea[name="data"]', form).val(JSON.stringify(reportData));
            form[0].submit();
        });
    }

    function formatResults(fieldUIs, rows) {
        function formatRow(row) {
            return whenAll( _.map(row, function(datum, i) {
                if (i === 0) return datum; // id field
                if (datum == null) return null;
                var fieldSpec = fieldUIs[i-1].fieldSpec;
                var field = fieldSpec.getField();
                if (field.type === "java.lang.Boolean") return !!datum;
                if (field.type === "java.lang.Integer") return datum;
                if (fieldSpec.treeRank || !field.isRelationship) {
                    if (field && (!fieldSpec.datePart || fieldSpec.datePart == 'Full Date')) {
                        return fieldformat(field, datum);
                    } else return datum;
                }
                switch (field.type) {
                case 'many-to-one':
                    return objformat(new (field.getRelatedModel().Resource)({ id: datum }));
                case 'one-to-many':
                    return (new field.model.Resource({ id: datum })).rget(field.name, true).pipe(aggregate);
                default:
                    console.error('unhandled field type:', field.type);
                    return datum;
                }
            }));
        }
        return whenAll( _.map(rows, formatRow) );
    }

    return {
        task: 'report',
        title: title,
        icon: '/images/Reports32x32.png',
        disabled: !status.available,
        execute: function() {
            app = require('specifyapp');
            var appRs = new schema.models.SpAppResource.LazyCollection();
            appRs.url = function() { return "/report_runner/get_reports/"; };
            appRs.fetch({ limit: 100 }).done(function() {
                (new ReportListDialog({ appResources: appRs })).render();
            });
        }
    };
});
