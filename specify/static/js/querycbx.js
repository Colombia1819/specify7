define([
    'jquery', 'underscore', 'backbone', 'specifyapi', 'schema', 'specifyform', 'templates',
    'dataobjformatters', 'whenall', 'parseselect', 'schemalocalization', 'navigation',
    'cs!saveblockers', 'cs!tooltipmgr',
    'text!resources/backstop/typesearch_def.xml',
    'text!resources/backstop/dialog_defs.xml',
    'jquery-ui'
], function ($, _, Backbone, api, schema, specifyform, templates, dataobjformat,
             whenAll, parseselect, schemalocalization, navigation, saveblockers,
             ToolTipMgr, typesearchxml, dialogdefxml) {
    var typesearches = $.parseXML(typesearchxml);
    var dialogdefs = $.parseXML(dialogdefxml);

    var QueryCbx = Backbone.View.extend({
        events: {
            'click .querycbx-edit': 'edit',
            'click .querycbx-add': 'add',
            'click .querycbx-search': 'search',
            'autocompleteselect': 'select',
            'blur input': 'fillIn'
        },
        select: function (event, ui) {
            var resource = ui.item.resource;
            this.model.set(this.fieldName, resource.url());
        },
        render: function () {
            var self = this;
            var control = self.$el;
            var querycbx = $(templates.querycbx());
            control.replaceWith(querycbx);
            self.setElement(querycbx);
            self.$('input').replaceWith(control);
            self.fieldName = control.attr('name');
            control.prop('readonly') && self.$('a').hide();

            var init = specifyform.parseSpecifyProperties(control.data('specify-initialize'));
            self.typesearch = $('[name="'+init.name+'"]', typesearches); // defines the querycbx
            if (!init.clonebtn || init.clonebtn.toLowerCase() !== "true") self.$('.querycbx-clone').hide();

            var typesearchTxt = self.typesearch.text().trim();
            var mapper = typesearchTxt ? parseselect.colToFieldMapper(typesearchTxt) : _.identity;
            self.displaycols = _(self.typesearch.attr('displaycols').split(',')).map(mapper);

            var field = self.model.specifyModel.getField(self.fieldName);
            self.relatedModel = field.getRelatedModel();
            var searchField = self.relatedModel.getField(self.typesearch.attr('searchfield'));
            control.attr('title', 'Searches: ' + searchField.getLocalizedName());

            control.autocomplete({
                minLength: 3,
                source: function (request, response) {
                    var collection = api.queryCbxSearch(self.relatedModel, searchField.name, request.term);
                    collection.fetch().pipe(function() {
                        var rendering = collection.chain().compact().map(_.bind(self.renderItem, self)).value();
                        return whenAll(rendering).done(response);
                    }).fail(function() { response([]); });
                }
            });

            self.model.on('change:' + self.fieldName.toLowerCase(), self.fillIn, self);
            self.fillIn();

            self.toolTipMgr = new ToolTipMgr(self, control).enable();
            self.saveblockerEnhancement = new saveblockers.FieldViewEnhancer(self, self.fieldName, control);
            return self;
        },
        fillIn: function () {
            var self = this;
            self.model.rget(self.fieldName, true).done(function(related) {
                related && self.renderItem(related).done(function(item) {
                    self.$('input').val(item.value);
                });
            });
        },
        renderItem: function (resource) {
            var str = this.typesearch.attr('format');
            var rget = _.bind(resource.rget, resource);
            var buildLabel = str &&
                whenAll(_(this.displaycols).map(rget)).pipe(function(vals) {
                    _(vals).each(function (val) { str = str.replace(/%s/, val); });
                    return str;
                });
            var buildValue = dataobjformat(resource, this.typesearch.attr('dataobjformatter'));
            return $.when(buildLabel, buildValue).pipe(function(label, value) {
                return { label: label || value, value: value, resource: resource };
            });
        },
        search: function(event, ui) {
            event.preventDefault();
            var dialogDef = $('dialog[type="search"][name="' + this.relatedModel.searchDialog + '"]', dialogdefs);
            var form = $(specifyform.buildViewByName(dialogDef.attr('view')));
            schemalocalization.localizeForm(form);
            form.find('.specify-form-header, input[value="Delete"], :submit').remove();
            $('<div title="Search">').append(form).dialog({
                width: 'auto',
                buttons: [
                    { text: "Search", click: function() {} }
                ],
                close: function() {
                    $(this).remove();
                }
            });
        },
        add: function(event, ui) {
            var self = this;
            event.preventDefault();
            var popUp = window.open(self.model.viewUrl() + self.fieldName + '/new/');
            popUp.specifyParentResource = self.model;
        },
        edit: function(event, ui) {
            var self = this;
            event.preventDefault();
            self.model.rget(self.fieldName, true).done(function(related) {
                related && window.open(related.viewUrl());
            });
        }
    });

    return QueryCbx;
});
