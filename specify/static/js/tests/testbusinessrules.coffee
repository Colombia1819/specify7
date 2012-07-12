define ['jquery', 'underscore', 'specifyapi', 'schema'], ($, _, api, schema) -> ->

    getCollectionObject = (id, callback) ->
        collectionobject = new (api.Resource.forModel 'collectionobject') id: id
        collectionobject.fetchIfNotPopulated().done callback
        collectionobject

    module 'collection object businessrules'
    test 'dup catalognumber', ->
        expect 3
        stop()
        collectionobject = getCollectionObject 100, ->
            collectionobject.on 'businessrule:catalognumber', (resource, result) ->
                ok true, 'businessrule event is triggered'
                ok (not result.valid), 'field is in valid'
                equal result.reason, 'Catalog number already in use', 'catalog number is dupped'
                start()
            collectionobject.set 'catalognumber',  "000037799"

    test 'catalognumber unique', ->
        expect 2
        stop()
        collectionobject = getCollectionObject 100, ->
            collectionobject.on 'businessrule:catalognumber', (resource, result) ->
                ok true, 'businessrule event is triggered'
                ok result.valid, 'catalog number is valid'
                start()
            collectionobject.set 'catalognumber', "999999999"

    test 'catalognumber set to original value', ->
        expect 4
        stop()
        collectionobject = getCollectionObject 102, ->
            origCatNum = collectionobject.get 'catalognumber'
            collectionobject.on 'businessrule:catalognumber', (resource, result) ->
                ok true, 'businessrule event triggered'
                ok result.valid, 'is valid'
                if (collectionobject.get 'catalognumber') is "999999999"
                    collectionobject.set 'catalognumber', origCatNum
                else
                    start()
            collectionobject.set 'catalognumber', "999999999"