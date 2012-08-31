define(['underscore', 'schemabase'], function(_, schema) {
    "use strict";

    return {
        Collection: function(model) {
            var fields = model.getAllFields();
            var collectionObjects = _(new schema.Field(model)).extend({
                name: 'collectionObjects',
                isRelationship: true,
                isRequired: false,
                type: 'one-to-many',
                otherSideName: 'Collection',
                relatedModelName: 'CollectionObject'
            });
            fields.push(collectionObjects);
        },
        CollectionObject: function(model) {
            var collection = model.getField('collection');
            collection.otherSideName = 'collectionObjects';
        },
        Division: function(model) {
            var fields = model.getAllFields();
            var accessions = _(new schema.Field(model)).extend({
                name: 'accessions',
                isRelationship: true,
                isRequired: false,
                type: 'one-to-many',
                otherSideName: 'Division',
                relatedModelName: 'Accession'
            });
            fields.push(accessions);
        },
        Accession: function(model) {
            var division = model.getField('division');
            division.otherSideName = 'accessions';
        },
        PrepType: function(model) {
            var fields = model.getAllFields();
            var preparations = _(new schema.Field(model)).extend({
                name: 'preparations',
                isRelationship: true,
                isRequired: false,
                type: 'one-to-many',
                otherSideName: 'PrepType',
                relatedModelName: 'Preparation'
            });
            fields.push(preparations);
        },
        Preparation: function(model) {
            var preptype = model.getField('preptype');
            preptype.otherSideName = 'preparations';
        }
    };
});
