define([
    'jquery', 'backbone', 'datamodel', 'schemalocalization', 'specifyform', 'picklist',
    'querycbx', 'recordselector', 'specifyplugins', 'dataobjformatters', 'subviewbutton', 'formtable', 'subview'
], function($, Backbone, datamodel, schemalocalization, specifyform,  setupPickList, setupQueryCbx,
            RecordSelector, uiplugins, dof, SubViewButton, FormTable, SubView) {
    "use strict";

    function setupUIplugin (control, resource) {
        var init = specifyform.parseSpecifyProperties(control.data('specify-initialize'));
        var plugin = uiplugins[init.name];
        plugin && resource.fetchIfNotPopulated().done(function () { plugin(control, init, resource); });
    };

    function setupControls (form, resource) {
        function controlChanged() {
            var control = $(this);
            resource.set(control.attr('name'), control.val());
        };

        form.find('.specify-field').each(function () {
            var control = $(this);
            if (control.is('.specify-combobox')) {
                return setupPickList(control, resource);
            } else if (control.is('.specify-querycbx')) {
                return setupQueryCbx(control, resource);
            } else if (control.is('.specify-uiplugin')) {
                return setupUIplugin(control, resource);
            } else {
                var fetch = resource.rget(control.attr('name'), true);
                var fillItIn = control.is('input[type="checkbox"]') ?
                    _(control.prop).bind(control, 'checked') :
                    _(control.val).bind(control);

                control.change(controlChanged);

                if (datamodel.isRelatedField(resource.specifyModel, control.attr('name'))) {
                    control.removeClass('specify-field').addClass('specify-object-formatted');
                    control.prop('readonly', true);
                    fetch.pipe(dof.dataObjFormat).done(fillItIn);
                } else fetch.done(fillItIn);
            }
        });
    };

    // This function is the main entry point for this module. It calls
    // the processView function in specifyform.js to build the forms
    // then fills them in with the given data or pointer to data.
    function populateForm (form, resource) {
        schemalocalization.localizeForm(form);
        setupControls(form, resource);

        var model = resource.specifyModel;
        form.find('.specify-subview').each(function () {
            var node = $(this);
            if (specifyform.isSubViewButton(node)) {
                (new SubViewButton({ parentModel: model, model: resource, el: node })).render();
                return;
            }

            var fieldName = node.data('specify-field-name');
            var relType = datamodel.getRelatedFieldType(model, fieldName);

            resource.rget(fieldName, true).done(function (related) {
                var View, viewOptions = { el: node, resource: resource, fieldName: fieldName };
                switch (relType) {
                case 'one-to-many':
                    View = specifyform.subViewIsFormTable(node) ? FormTable : RecordSelector;
                    viewOptions.collection = related;
                    break;
                case 'zero-to-one':
                case 'many-to-one':
                    View = SubView;
                    viewOptions.model = related
                    break;
                default:
                    node.append('<p>unhandled relationship type: ' + relType + '</p>');
                    return;
                }
                (new View(viewOptions)).render();
            });
        });
        return form;
    };

    return populateForm;
});
