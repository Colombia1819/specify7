define ['jquery', 'underscore', 'specifyapi', 'schema'], ($, _, api, schema) -> ->

    getCollectionObject = (id, callback) ->
        collectionobject = new (api.Resource.forModel 'collectionobject') id: id
        collectionobject.fetch().done callback
        collectionobject

    module 'businessrules'
    test 'business rules pending flag', ->
        expect 3
        stop()
        collectionobject = getCollectionObject 100, ->
            collectionobject.businessRuleMgr.getPromise ->
                collectionobject.on 'businessrulescomplete', (resource) ->
                    ok (not collectionobject.businessRuleMgr.pending), 'not pending'
                    start()
                ok (not collectionobject.businessRuleMgr.pending), 'not pending'
                collectionobject.set 'catalognumber', "999999999"
                ok (collectionobject.businessRuleMgr.pending), 'is pending'

    test 'delete blockers', ->
        expect 3
        stop()
        accession = new (api.Resource.forModel 'accession') id: 3
        accession.rget('collectionobjects', true).done (COs) ->
            ok (not accession.businessRuleMgr.canDelete()), 'starts with delete blocked'
            accession.on 'candelete', ->
                ok true, 'candelete event triggered'
                ok accession.businessRuleMgr.canDelete(), 'canDelete() returns true'
                start()
            orig = accession.getRelatedObjectCount
            accession.getRelatedObjectCount = (fieldname) ->
                if fieldname is 'collectionobjects' then $.when 0 else orig fieldname
            accession.trigger 'remove:collectionobjects'

    test 'checkCanDelete with block', ->
        expect 1
        stop()
        accession = new (api.Resource.forModel 'accession') id: 3
        accession.rget('collectionobjects', true).done (COs) ->
            ok (not accession.businessRuleMgr.canDelete()), 'starts with delete blocked'
            accession.on 'candelete', ->
                ok false, 'candelete event should not be triggered'
            accession.businessRuleMgr.checkCanDelete().done ->
                _.delay start, 1000

    test 'checkCanDelete with no block', ->
        expect 2
        stop()
        accession = new (api.Resource.forModel 'accession') id: 1
        accession.rget('collectionobjects', true).done (COs) ->
            ok (not accession.businessRuleMgr.canDelete()), 'starts with delete blocked'
            accession.on 'candelete', ->
                ok true, 'candelete event triggered'
                start()
            accession.businessRuleMgr.checkCanDelete()

    module 'collection object businessrules'
    test 'dup catalognumber', ->
        expect 3
        stop()
        collectionobject = getCollectionObject 100, ->
            collectionobject.on 'businessrule:catalognumber', (resource, result) ->
                ok true, 'businessrule event is triggered'
                ok (not result.valid), 'field is invalid'
                ok _(result.reason).isString(), 'reason is given'
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

    test 'catalognumber unique in collection where some collection objects have been fetched', ->
        expect 4
        stop()
        collection = new (api.Resource.forModel 'collection') id: 4
        collection.rget('collectionobjects', true).done (COs) ->
            tests = [
                [0, '999999999', true, 'ok b/c this no. is unused'],
                [1, '000000001', true, 'this no. was in use by COs.at(0). but we just changed that one'],
                [2, '000037799', false, 'not ok b/c no. is used (even tho the conflicting CO is not fetched'],
                [3, '999999999', false, 'conflicts with the first object now.']
            ]

            nextTest = ->
                if tests.length is 0 then return start()
                [i, catNum, expectedValid, doc] = tests.shift()
                COs.at(i).on 'businessrule:catalognumber', (resource, result) ->
                    equal result.valid, expectedValid, doc
                    nextTest()
                COs.at(i).set 'catalognumber', catNum

            nextTest()
