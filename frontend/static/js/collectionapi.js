define([
    'jquery', 'underscore', 'backbone', 'whenall', 'assert', 'jquery-bbq'
], function($, _, Backbone, whenAll, assert) {
    "use strict";

    var Base =  Backbone.Collection.extend({
        __name__: "CollectionBase",
        populated: false,   // set if the collection has been fetched or filled in
        wasInline: false,   // set when a collection is populated from inlined data for a one-to-many

        initialize: function(models) {
            this.queryParams = {}; // these define the filters on the collection
            if (models) this.populated = true;
            this.on('add remove', function() {
                this.trigger('saverequired');
            }, this);
        },
        url: function() {
            return '/api/specify/' + this.model.specifyModel.name.toLowerCase() + '/';
        },
        parse: function(resp, xhr) {
            _.extend(this, {
                wasInline: _.isUndefined(resp.meta),
                populated: true,   // have data now
                totalCount: resp.meta ? resp.meta.total_count : resp.length,
                meta: resp.meta
            });
            return this.wasInline ? resp : resp.objects;
        },
        fetchIfNotPopulated: function () {
            var collection = this;
            // a new collection is used for to-many collections related to new resources
            if (this.isNew) return $.when(collection);
            if (this._fetch) return this._fetch.pipe(function () { return collection; });

            return this.populated ? $.when(collection) : this.fetch().pipe(function () { return collection; });
        },
        fetch: function(options) {
            var self = this;
            // block trying to fetch data for collections that represent new to-many collections
            if (self.isNew) {
                throw new Error("can't fetch non-existant collection");
            }

            if (self._fetch) throw new Error('already fetching');

            options = options || {};
            options.update = true;
            options.remove = false;
            options.silent = true;
            options.at = _.isUndefined(options.at) ? self.length : options.at;
            options.data = options.data || _.extend({}, self.queryParams);
            options.data.offset = options.at;
            if (_(options).has('limit')) options.data.limit = options.limit;
            self._fetch = Backbone.Collection.prototype.fetch.call(self, options);
            return self._fetch.then(function() { self._fetch = null; });
        },
        abortFetch: function() {
            if (!this._fetch) return;
            this._fetch.abort();
            this._fetch = null;
        },
        add: function(models, options) {
            options = options || {};
            options.at = _.isUndefined(options.at) ? this.length : options.at;
            models = _.isArray(models) ? models.slice() : [models];
            if (this.totalCount) {
                if (this.models.length < this.totalCount) this.models[this.totalCount-1] = undefined;
                this.models.splice(options.at, models.length);
                this.length = this.models.length;
            }
            return Backbone.Collection.prototype.add.apply(this, arguments);
        },
        getTotalCount: function() {
            var self = this;
            if (self.isNew) return $.when(self.length);
            if (self._fetch) return self._fetch.pipe(function() { return self.totalCount; });
            return self.fetchIfNotPopulated().pipe(function() { return self.totalCount; });
        }
    });

    var ToOne = Base.extend({
        __name__: "ToOneCollectionBase",
        initialize: function(models, options) {
            // options = {
            //    field: schema.Model.getField(...): the toOne field this collection represents,
            //    related: schema.Model.Resource: the resource this collecion is "to",
            //    [Base options]
            // }
            assert(options.field.model === this.model.specifyModel, "field doesn't belong to model");

            this.field = options.field;
            this.related = options.related;

            // If the id of the related resource changes, we go through and update
            // all the objects that point to it with the new pointer.
            // This is to support having collections of objects attached to
            // newly created resources that don't have ids yet. When the
            // resource is saved, the related objects can have their FKs
            // set correctly.
            this.related.on('change:id', function() {
                var relatedUrl = this.related.url();
                _.chain(this.models).compact().invoke('set', this.field.name, relatedUrl);
            }, this);

            Base.prototype.initialize.apply(this, arguments);
        },
        fetch: function() {
            assert(this.related.id, "Can't fetch many-to-one collection for nonexistent resource.");
            this.queryParams[this.field.name.toLowerCase()] = this.related.id;
            return Base.prototype.fetch.apply(this, arguments);
        }
    });

    var Dependent = ToOne.extend({
        __name__: "DependentCollectionBase",
        isDependent: true
    });

    return { Base: Base, ToOne: ToOne, Dependent: Dependent };
});
