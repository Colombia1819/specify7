define([
    'jquery', 'underscore', 'schemalocalization',
    'text!/static/resources/specify_datamodel.xml'
], function($, _, schemalocalization, xml) {
    "use strict";

    var Model = function(node) {
        this.node = $(node);
        this.name = this.node.attr('classname').split('.').pop();
        this.view = this.node.find('display').attr('view');
    };
    _.extend(Model.prototype, {
        getField: function(name) {
            if (_(name).isString()) {
                name = name.toLowerCase().split('.');
            }
            var field = _(this.getAllFields()).find(function(field) { return field.name.toLowerCase() === name[0]; });
            return name.length === 1 ? field : field.getRelatedModel().getField(_(name).tail());
        },
        getAllFields: function () {
            var self = this;
            self.fields = self.fields || _.toArray(
                self.node.find('field, relationship').map(function() { return new Field(self, this); })
            );
            return self.fields;
        },
        getLocalizedName: function() {
            return schemalocalization.getLocalizedLabelForModel(this.name);
        }
    });

    var Field = function(model, node) {
        this.node = $(node);
        this.model = model;
        this.name = this.node.attr('name') || this.node.attr('relationshipname');
        this.isRelationship = this.node.is('relationship');
        this.isRequired = this.node.attr('required') === 'true';
        this.type = this.node.attr('type');
        if (this.isRelationship) this.otherSideName = this.node.attr('othersidename');
    };
    _.extend(Field.prototype, {
        getRelatedModel: function() {
            if (!this.isRelationship) return undefined;
            return schema.getModel(this.node.attr('classname').split('.').pop());
        },
        getLocalizedName: function() {
            return schemalocalization.getLocalizedLabelForField(this.name, this.model.name);
        },
        getLocalizedDesc: function() {
            return schemalocalization.getLocalizedDescForField(this.name, this.model.name);
        }
    });

    var schema = {
        models: {},
        getModel: function(name) {
            name = name.toLowerCase();
            return _(this.models).find(function(model) { return model.name.toLowerCase() === name; });
        }
    };

    $('table', $.parseXML(xml)).each(function() {
        var model = new Model(this);
        schema.models[model.name] = model;
    });

    return schema;
});