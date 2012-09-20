define ['jquery', 'underscore', 'backbone', 'templates'], ($, _, Backbone, templates) ->

    Backbone.View.extend
        events:
            click: 'submit'
        initialize: (options) ->
            @blockers = {}

            @model.on 'saverequired', (resource) =>
                @button.prop 'disabled', false

            @model.on 'oktosave', (resource) =>
                @removeBlocker resource

            @model.on 'saveblocked', (resource) =>
                @blockers[resource.cid] ?= resource.on 'destroy', @removeBlocker, @
                @button.prop 'disabled', false
                @button.addClass 'saveblocked'

        removeBlocker: (resource) ->
            delete @blockers[resource.cid]
            if _.isEmpty @blockers
                @button.removeClass 'saveblocked'

        render: ->
            @button = $('<input type="submit">').appendTo(@el)
            @button.prop 'disabled', true
            @dialog = $(templates.saveblocked()).insertAfter(@el).dialog
                resizable: false
                autoOpen: false
            @dialog.parent('.ui-dialog').insertAfter(@el)
            @

        submit: (evt) ->
            evt.preventDefault()
            if _.isEmpty @blockers
                @button.prop 'disabled', true
                @model.rsave().done => @trigger 'savecomplete'
            else
                list = @dialog.find '.saveblockers'
                list.empty()
                _.each @blockers, (resource) =>
                    li = $('<li>').appendTo list
                    li.append $('<h3>').text(resource.specifyModel.getLocalizedName())
                    dl = $('<dl>').appendTo li
                    _.each resource.saveBlockers.getAll(), (blocker) ->
                        field = resource.specifyModel.getField blocker.field if blocker.field?
                        $('<dt>').text(field?.getLocalizedName() or '').appendTo dl
                        $('<dd>').text(blocker.reason).appendTo dl
                @dialog.dialog 'open'

