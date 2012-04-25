define(['jquery', 'underscore', 'backbone', 'datamodel', 'jquery-bbq'], function($, _, Backbone, datamodel) {
    var self = {}, resources = {}, collections = {};

    var whenAll = self.whenAll = function(deferreds) {
        return $.when.apply($, deferreds).pipe(function() { return _(arguments).toArray(); });
    };

    function isResourceOrCollection(obj) { return obj instanceof Resource || obj instanceof Collection; }

    var Collection = self.Collection = Backbone.Collection.extend({
        populated: false,
        initialize: function(models) {
            if (models) this.populated = true;
            this.queryParams = {};
        },
        url: function() {
            var url = '/api/specify/' + this.model.specifyModel.toLowerCase() + '/';
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
        forModel: function(modelName) {
            var cannonicalName = datamodel.getCannonicalNameForModel(modelName);
            if (!_(collections).has(cannonicalName)) {
                collections[cannonicalName] = Collection.extend({
                    model: Resource.forModel(modelName)
                });
            }
            return collections[cannonicalName];
        },
        fromUri: function(uri) {
            var match = /api\/specify\/(\w+)\//.exec(uri);
            var collection = new (Collection.forModel(match[1]))();
            _.extend(collection.queryParams, $.deparam.querystring(uri));
            return collection;
        }
    });

    var Resource = self.Resource = Backbone.Model.extend({
        populated: false, _fetch: null, needsSaved: false,
        initialize: function(attributes, options) {
            if (attributes && _(attributes).has('resource_uri')) this.populated = true;
            this.on('change', function() {
                this.needsSaved = true;
            });
            this.on('sync', function() {
                this.needsSaved = false;
            });
            this.relatedCache = {};
        },
        url: function() {
            return '/api/specify/' + this.specifyModel.toLowerCase() + '/' +
                (!this.isNew() ? (this.id + '/') : '');
        },
        viewUrl: function() {
            return '/specify/view/' + this.specifyModel.toLowerCase() + '/' + this.id + '/';
        },
        get: function(attribute) {
            return Backbone.Model.prototype.get.call(this, attribute.toLowerCase());
        },
        set: function(key, value, options) {
            var attrs = {}, self = this;
            if (_.isObject(key) || key == null) {
                _(key).each(function(value, key) { attrs[key.toLowerCase()] = value; });
                options = value;
            } else {
                attrs[key.toLowerCase()] = value;
            }
            if (self.relatedCache)
                _(attrs).each(function(value, key) { delete self.relatedCache[key]; });
            return Backbone.Model.prototype.set.call(this, attrs, options);
        },
        rget: function(field, prePop) { var self = this; return this.fetchIfNotPopulated().pipe(function() {
            var path = _(field).isArray()? field : field.split('.');
            field = path[0].toLowerCase();
            var value = self.get(field);
            if (!datamodel.isRelatedField(self.specifyModel, field))
                return path.length === 1 ? value : undefined;

            if (_.isNull(value) || _.isUndefined(value))
                return value;

            var related = datamodel.getRelatedModelForField(self.specifyModel, field);

            switch (datamodel.getRelatedFieldType(self.specifyModel, field)) {
            case 'many-to-one':
                var toOne = self.relatedCache[field];
                if (!toOne) {
                    if (_.isString(value)) toOne = Resource.fromUri(value);
                    else {
                        toOne = Resource.fromUri(value.resource_uri);
                        toOne.set(value);
                        toOne.populated = true;
                    }
                    toOne.on('change rchange', function() { self.trigger('rchange'); });
                    self.relatedCache[field] = toOne;
                }
                return (path.length > 1) ? toOne.rget(_.tail(path)) : (
                    prePop ? toOne.fetchIfNotPopulated() : toOne
                );
            case 'one-to-many':
                if (path.length > 1) return undefined;
                if (self.relatedCache[field]) return self.relatedCache[field];
                var toMany = (_.isString(value)) ? Collection.fromUri(value) :
                    new (Collection.forModel(related))(value);
                toMany.queryParams[self.specifyModel.toLowerCase()] = self.id;
                self.relatedCache[field] = toMany;
                toMany.on('change rchange', function() { self.trigger('rchange'); });
                return prePop ? toMany.fetchIfNotPopulated() : toMany;
            case 'zero-to-one':
                if (self.relatedCache[field]) {
                    value = self.relatedCache[field];
                    return (path.length === 1) ? value : value.rget(_.tail(path));
                }
                var collection = _.isString(value) ? Collection.fromUri(value) :
                    new (Collection.forModel(related))(value);
                return collection.fetchIfNotPopulated().pipe(function() {
                    var value = collection.isEmpty() ? null : collection.first();
                    value && value.on('change rchange', function() { self.trigger('rchange'); });
                    self.relatedCache[field] = value;
                    return (path.length === 1) ? value : value.rget(_.tail(path));
                });
            }
        });},
        rsave: function() {
            var resource = this;
            var deferreds = _(resource.relatedCache).invoke('rsave');
            deferreds.push(resource.needsSaved && resource.save());
            // If there is a circular dependency we could end up
            // saving over and over, so if we are saving already
            // return the previous saves deferred. This means you
            // can't save and then make changes and save again while
            // the first save is pending, but that would be insane
            // anyways.
            return resource._rsaveDeferred = resource._rsaveDeferred ||
                whenAll(deferreds).then(function() { resource._rsaveDeferred = null; });
        },
        fetchIfNotPopulated: function() {
            var resource = this;
            if (resource.populated) return $.when(resource)
            if (resource.isNew()) return $.when(resource)
            if (resource._fetch !== null) return resource._fetch;
            resource._fetch = resource.fetch({silent: true}).pipe(function() {
                resource._fetch = null;
                return resource;
            });
            return resource._fetch;
        },
        parse: function() {
            this.populated = true;
            return Backbone.Model.prototype.parse.apply(this, arguments);
        },
        getRelatedObjectCount: function(field) {
            if (datamodel.getRelatedFieldType(this.specifyModel, field) !== 'one-to-many') {
                throw new TypeError('field is not one-to-many');
            }
            return this.rget(field).pipe(function (collection) {
                if (_.has(collection, 'totalCount')) return collection.totalCount;
                // should be some way to get the count without getting any objects
                collection.limit = 1;
                return collection.fetch().pipe(function () {
                    return collection.totalCount;
                });
            });
        },
        sync: function(method, resource, options) {
            if (method === 'delete') {
                options = options || {};
                options.headers = {'If-Match': resource.get('version')};
            }
            return Backbone.sync(method, resource, options);
        }
    }, {
        forModel: function(modelName) {
            var cannonicalName = datamodel.getCannonicalNameForModel(modelName);
            if (!cannonicalName) return null;
            if (!_(resources).has(cannonicalName)) {
                resources[cannonicalName] = Resource.extend({
                    specifyModel: cannonicalName
                }, {
                    specifyModel: cannonicalName
                });
            }
            return resources[cannonicalName];
        },

        fromUri: function(uri) {
            var match = /api\/specify\/(\w+)\/(\d+)\//.exec(uri);
            var ResourceForModel = Resource.forModel(match[1]);
            return new ResourceForModel({id: match[2]});
        }
    });

    self.getPickListByName = function(pickListName) {
        var pickListUri = "/api/specify/picklist/?name=" + pickListName;
        var collection = Collection.fromUri(pickListUri);
        return collection.fetch().pipe(function() { return collection.first(); });
    };

    self.queryCbxSearch = function(model, searchfield, searchterm) {
        var collection = new (Collection.forModel(model))();
        collection.queryParams[searchfield.toLowerCase() + '__icontains'] = searchterm;
        return collection;
    };

    return self;
});
