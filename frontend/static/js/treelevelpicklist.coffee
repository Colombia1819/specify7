define [
    'jquery'
    'underscore'
    'backbone'
    'specifyapi'
], ($, _, Backbone, api) ->

    Backbone.View.extend
        __name__: "TreeLevelPickListView"
        events: change: 'changed'

        initialize: (options) ->
            @model.on 'change:parent', @render, @
            @lastFetch = null

        render: ->
            @$el.empty()

            @lastFetch = fetch = @model.rget('parent.definitionitem', true).pipe (parentTreeDefItem) ->
                if not parentTreeDefItem then return _([])
                children = new (parentTreeDefItem.constructor.collectionFor())()
                children.queryParams.rankid__gt = parentTreeDefItem.get 'rankid'
                children.fetch(limit: 0).pipe -> children

            fetch.done (children) => if fetch is @lastFetch
                fieldName = @$el.attr 'name'
                value = @model.get fieldName
                children.each (child) =>
                    url = child.url()
                    @$el.append $('<option>',
                        value: url
                        selected: url is value
                    ).text child.get 'name'

                # make sure value in the resouce is consitent with what is displayed.
                if not value or @$el.find('option[value="' + value + '"]').length < 1
                    @model.set fieldName, children.first()
            @

        changed: ->
            selected = api.Resource.fromUri @$el.val()
            @model.set @$el.attr('name'), selected
