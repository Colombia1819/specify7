define([
    'jquery', 'underscore', 'backbone', 'resourceapi', 'schema', 'whenall', 'jquery-bbq'
], function($, _, Backbone, api, schema, whenAll) {

    api.Collection = Backbone.Collection.extend({
        populated: false, needsSaved: false,
        initialize: function(models) {
            if (models) this.populated = true;
            this.queryParams = {};
        },
        url: function() {
            return '/api/specify/' + this.model.specifyModel.name.toLowerCase() + '/';
        },
        parse: function(resp, xhr) {
            _.extend(this, {
                populated: true,
                limit: resp.meta.limit,
                totalCount: resp.meta.total_count,
            });
            return resp.objects;
        },
        fetchIfNotPopulated: function () {
            var collection = this;
            if (this.isNew) return $.when(collection);
            return this.populated ? $.when(collection) : this.fetch().pipe(function () { return collection; });
        },
        fetch: function(options) {
            if (this.isNew) return $.when(null);
            options = options || {};
            options.add = true;
            options.silent = true;
            options.at = options.at || this.length;
            options.data = options.data || _.extend({}, this.queryParams);
            options.data.offset = options.at;
            if (_(this).has('limit')) options.data.limit = this.limit;
            return Backbone.Collection.prototype.fetch.call(this, options);
        },
        add: function(models, options) {
            options = options || {};
            options.at = options.at || this.length;
            models = _.isArray(models) ? models.slice() : [models];
            if (this.totalCount) {
                if (this.models.length < this.totalCount) this.models[this.totalCount-1] = undefined;
                this.models.splice(options.at, models.length);
                this.length = this.models.length;
            }
            return Backbone.Collection.prototype.add.apply(this, arguments);
        },
        rsave: function() {
            return whenAll(_.chain(this.models).compact().invoke('rsave').value());
        },
        gatherDependentFields: function() {
            this.invoke('gatherDependentFields');
        },
        rNeedsSaved: function() {
            if (this.needsSaved) return true;
            return _.any(this.invoke('rNeedsSaved'));
        }
    }, {
        forModel: function(model) {
            model = _(model).isString() ? schema.getModel(model) : model;
            if (!_(collections).has(model.name)) {
                collections[model.name] = api.Collection.extend({
                    model: api.Resource.forModel(model)
                });
            }
            return collections[model.name];
        },
        fromUri: function(uri) {
            var match = /api\/specify\/(\w+)\//.exec(uri);
            var collection = new (api.Collection.forModel(match[1]))();
            if (uri.indexOf("?") !== -1)
                _.extend(collection.queryParams, $.deparam.querystring(uri));
            return collection;
        }
    });

    var RecordSetItems = api.Collection.extend({
        initialize: function() {
            this.model = api.Resource.forModel('recordsetitem');
            return this.constructor.__super__.initialize.apply(this, arguments);
        },
        fetch: function(options) {
            options = options || {};
            options.itemFetchDeferreds = [];
            var mainFetch = api.Collection.prototype.fetch.call(this, options);
            var comprehensiveFetch = mainFetch.pipe(function() {
                return whenAll(options.itemFetchDeferreds);
            });
            comprehensiveFetch.abort = function() { return mainFetch.abort(arguments); };
            return comprehensiveFetch;
        },
        add: function(models, options) {
            api.Collection.prototype.add.call(this, models, options);
            var ItemResource = api.Resource.forModel(
                schema.getModelById(this.parent.get('dbTableId'))
            );
            var recordSetItems = this;
            _(models).forEach(function(model) {
                var recordSetItem = recordSetItems.get(model.id);
                var item = new ItemResource({ id: recordSetItem.get('recordId') });
                recordSetItem.item = item;
                options.itemFetchDeferreds.push(item.fetch());
            });
            return this;
        },
        at: function(index) {
            var recordSetItem = api.Collection.prototype.at.call(this, index);
            return recordSetItem && recordSetItem.item;
        }
    });

    var collections = {
        RecordSetItem: RecordSetItems
    };

    return api;
});
