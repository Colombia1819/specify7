define ['underscore'], (_) ->

    class BusinessRuleMgr
        constructor: (@resource) ->
            @fieldChangeDeferreds = {}
            @rules = rules[@resource.specifyModel.name]

        changed: (resource, options) ->
            _(options.changes).each (wasChanged, fieldName) =>
                if wasChanged
                    rule = @rules?.fieldChange[fieldName]
                    deferred = @fieldChangeDeferreds[fieldName] = rule? resource
                    deferred?.done (result) =>
                        if deferred is @fieldChangeDeferreds[fieldName]
                            delete @fieldChangeDeferreds[fieldName]
                            @changedResult fieldName, result

        changedResult: (fieldName, result) ->
            if not result.valid
                @resource.trigger 'businessruleerror', @resource
                @resource.trigger "businessruleerror:#{ fieldName }", @resource, result

    rules =
        CollectionObject:
            fieldChange:
                catalognumber: (collectionobject) ->
                    collectionobject.rget('collection.collectionobjects').pipe (COs) ->
                        otherCOs = new COs.constructor()
                        _.extend otherCOs.queryParams,
                            collection: COs.parent.id
                            catalognumber: collectionobject.get 'catalognumber'
                        otherCOs.fetch().pipe ->
                            if otherCOs.totalCount is 0
                                valid: true
                            else if otherCOs.totalCount is 1 and otherCOs.at(0).id is collectionobject.id
                                valid: true
                            else
                                valid: false, reason: 'Catalog number already in use'

    businessRules =
        attachToResource: (resource) ->
            mgr = resource.businessRuleMgr = new BusinessRuleMgr resource
            resource.on 'change', mgr.changed, mgr
