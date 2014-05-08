define([
'jquery', 'underscore', 'backbone', 'appresource', 'schema', 'queryresultstable',
'queryfieldspec', 'props', 'scrollresults', 'whenall',
'text!context/available_related_searches.json!noinline',
'text!properties/expresssearch_en.properties!noinline',
'jquery-bbq', 'jquery-ui'
], function($, _, Backbone, getAppResource, schema, QueryResultsTable,
            QueryFieldSpec, props, ScrollResults, whenAll,
            availableRelatedJson, propstext) {
    "use strict";

    var relatedSearches = $.parseJSON(availableRelatedJson);
    var getProp = _.bind(props.getProperty, props, propstext);
    var accordionOptions = {
        autoHeight: false,
        collapsible: true,
        active: false
    };

    var ResultsView = Backbone.View.extend({
        __name__: "ResultsView",
        events: {
            'accordionchange': 'panelOpened'
        },
        render: function() {
            this.$el.append('<h3>Primary Search</h3><p class="status primary">Running...</p><div class="results primary"></div>');
            this.$el.append('<h3>Secondary Search</h3><p class="status related">Running...</p><div class="results related"></div>');
            this.$('.results').accordion(accordionOptions);
            var query = $.deparam.querystring().q;
            $('.express-search-query').val(query);

            this.doPrimarySearch(query);
            this.doRelatedSearches(query);
            return this;
        },
        doPrimarySearch: function(query) {
            var ajaxUrl = $.param.querystring('/express_search/', {q: query});
            $.get(ajaxUrl, _.bind(this.showPrimaryResults, this, ajaxUrl));
        },
        showPrimaryResults: function(ajaxUrl, allTablesResults) {
            _.each(allTablesResults, _.bind(this.makePrimaryResultView, this, ajaxUrl));

            var counts = _.pluck(allTablesResults, 'totalCount');
            var totalCount = _.reduce(counts, (function(a, b) {return a + b;}), 0);

            var statusEl = this.$('.primary.status');
            totalCount < 1 ? statusEl.text('No Matches') : statusEl.hide();
            this.$('.results.primary').accordion('destroy').accordion(accordionOptions);
        },
        makePrimaryResultView: function(ajaxUrl, results, tableName) {
            if (results.totalCount < 1) return;
            var model = schema.getModel(tableName);
            var heading = model.getLocalizedName() + ' - ' + results.totalCount;
            this.$('.primary.results').append($('<h4>').append($('<a>').text(heading)));

            new QueryResultsTable({
                noHeader: true,
                model: model,
                fieldSpecs: _.map(results.fieldSpecs, QueryFieldSpec.fromStringId),
                initialData: results,
                fetchResults: function(offset) {
                    var url = $.param.querystring(ajaxUrl, {name: model.name, offset: offset});
                    return $.get(url).pipe(function(data) { return data[model.name]; });
                }
            }).render().$el.appendTo(this.$('.primary.results'));
        },
        doRelatedSearches: function(query) {
            var statusEl = this.$('.related.status');

            var deferreds = _.map(relatedSearches, function(rs) {
                var ajaxUrl = $.param.querystring('/express_search/related/', {q: query, name: rs});
                var showResults = _.bind(this.showRelatedResults, this, ajaxUrl);
                return $.get(ajaxUrl).pipe(showResults);
            }, this);

            whenAll(deferreds).then(function(counts) {
                var totalCount = _.reduce(counts, (function(a, b) {return a + b;}), 0);
                totalCount < 1 ? statusEl.text('No Matches') : statusEl.hide();
            });
        },
        showRelatedResults: function(ajaxUrl, data) {
            if (data.totalCount < 1) return 0;
            var results = new QueryResultsTable({
                noHeader: true,
                model: schema.getModel(data.definition.root),
                fieldSpecs: _.map(data.definition.fieldSpecs, QueryFieldSpec.fromStringId),
                initialData: data,
                ajaxUrl: ajaxUrl
            });
            var rsName = data.definition.name;
            var heading = (getProp(rsName) || rsName) + ' - ' + data.totalCount;
            this.$('.related.results').append($('<h4>').append($('<a>').text(heading)));
            results.render().$el.appendTo(this.$('.related.results'));
            this.$('.results.related').accordion('destroy').accordion(accordionOptions);
            return data.totalCount;
        },
        panelOpened: function(evt, ui) {
            var resultsView = ui.newContent.data('view');
            resultsView && resultsView.fetchMoreWhileAppropriate();
        }
    });

    return function(app) {
        app.router.route('express_search/', 'esearch', function() {
            app.setCurrentView(new ResultsView());
            window.document.title = 'Express Search | Specify WebApp';
        });
    };
});

