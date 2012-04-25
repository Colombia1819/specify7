define(['underscore', 'schema'], function(_, schema) {
    "use strict";
    return function() {
        module('schema');
        test('getModel', function() {
            var model = schema.getModel('collectionobject');
            equal(model.name, 'CollectionObject', 'model.name is cannonical');
            equal(model, schema.getModel('CollectionObject'), 'getting model by alternative name');
        });

        test('model.veiw', function() {
            var model = schema.getModel('collectionobject');
            ok(_(model.view).isString(), 'model.view is string');
        });

        test('model.getAllFields', function() {
            var fields = schema.getModel('collectionobject').getAllFields();
            ok(_(fields).isArray(), 'model.getAllFields returns array');
            equal(schema.getModel('collectionobject').getAllFields(), fields,
                  'subsequent calls return memoized value');
        });

        test('model.getField', function() {
            var model = schema.getModel('collectionobject');
            var field = model.getField('catalognumber');
            ok(_(model.getAllFields()).contains(field), 'field in getAllFields');
            equal(field.name.toLowerCase(), 'catalognumber', 'got the right field');
            equal(model.getField('catalogNumber'), field, 'getField is case-insensitive');
        });

        test('regular field attributes', function() {
            var model = schema.getModel('collectionobject');
            var field = model.getField('catalognumber');
            ok(!field.isRelationship, 'catalognumber is not relationship');
            ok(!field.isRequired, 'catalognumber is not required');
            equal(field.type, 'java.lang.String', 'catalognumber is String');
            ok(_.isUndefined(field.otherSideName), 'catalognumber has no othersidename');
            ok(_.isUndefined(field.getRelatedModel()), 'relatedModel returns undefined');
        });

        test('relationship field attributes', function () {
            var model = schema.getModel('collectionobject');
            var field = model.getField('collectingevent');
            ok(field.isRelationship, 'collectingevent is relationship field');
            ok(!field.isRequired, 'not required');
            equal(field.name.toLowerCase(), 'collectingevent', 'names match');
            equal(field.type, 'many-to-one', 'is many-to-one field');
            equal(field.otherSideName.toLowerCase(), 'collectionobjects', 'othersidename matches');
            equal(field.getRelatedModel(), schema.getModel('collectingevent'), 'getRelatedModel works');
        });
    };
});