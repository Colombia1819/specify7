define([
    'require', 'jquery', 'underscore', 'backbone', 'schema', 'whenall', 'jquery-bbq'
], function(require, $, _, Backbone, schema, whenAll) {
    var collections = {};

    var Collection = Backbone.Collection.extend({
        populated: false,
        initialize: function(models) {
            if (models) this.populated = true;
            this.queryParams = {};
        },
        url: function() {
            var url = '/api/specify/' + this.model.specifyModel.name.toLowerCase() + '/';
            return $.param.querystring(url, this.queryParams);
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
            return this.populated ? $.when(collection) : this.fetch().pipe(function () { return collection; });
        },
        fetch: function(options) {
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
        }
    }, {
        forModel: function(model) {
            model = _(model).isString() ? schema.getModel(model) : model;
            var Resource = require('resourceapi');
            if (!_(collections).has(model.name)) {
                collections[model.name] = Collection.extend({
                    model: Resource.forModel(model)
                });
            }
            return collections[model.name];
        },
        fromUri: function(uri) {
            var match = /api\/specify\/(\w+)\//.exec(uri);
            var collection = new (Collection.forModel(match[1]))();
            _.extend(collection.queryParams, $.deparam.querystring(uri));
            return collection;
        }
    });

    return Collection;
});
