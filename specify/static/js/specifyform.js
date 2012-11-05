define([
    'jquery', 'underscore', 'schema', 'specifyformcells', 'parsespecifyproperties',
    'processcolumndef', 'templates'
], function specifyform(
    $, _, schema, specifyformcells, parseSpecifyProperties,
    processColumnDef, templates
) {
    "use strict";
    var formCounter = 0;

    function getModelFromView(view) {
        view = _(view).isString() ? findView(view) : view;
        return view.attr('class').split('.').pop();
    }

    function getModelFromViewdef(viewdef) {
        return viewdef.attr('class').split('.').pop();
    }

    function getColumnDef(viewdef) {
        return viewdef.find('columnDef[os="lnx"]').first().text() || viewdef.find('columnDef').first().text();
    }

    function buildFormTable(formNumber, formViewdef, processCell) {
        var formTableCells = formViewdef.find('cell[type="field"], cell[type="subview"]');
        var table = $(templates.formtable({ formNumber: formNumber }));
        var headerRow = table.find('thead tr');
        var bodyRow = table.find('tbody tr');

        _(formTableCells).each(function (cell) {
            var label = $('<label>', {'for': 'specify-field-' + formNumber + '-' + $(cell).attr('id')});
            headerRow.append($('<th>').append(label));
            bodyRow.append(processCell(cell));
        });

        return table;
    }

    function buildForm(formNumber, viewdef, processCell) {
        var rows = viewdef.children('rows').children('row');
        var cellsIn = function(row) { return $(row).children('cell'); };
        var table = processColumnDef(getColumnDef(viewdef));

        _(rows).each(function (row) {
            var tr = $('<tr>').appendTo(table);
            var appendToTr = function(cell) { tr.append(cell); };
            _(cellsIn(row)).chain().map(processCell).each(appendToTr);
        });

        return $(templates.form({ formNumber: formNumber })).find('form').append(table).end();
    }

    function buildView(view, defaultType) {
        defaultType || (defaultType = 'form');
        var altviews = _.filter(view.altviews, function(av) { return av.mode == 'edit'; });

        var viewdefs = {};
        _.each(view.viewdefs, function(xml, name) {
            viewdefs[name] = $($.parseXML(xml)).find('viewdef');
        });

        var viewdef;
        _.find(altviews, function(av) {
            viewdef = viewdefs[av.viewdef];
            return viewdef.attr('type') === defaultType;
        });

        viewdef || (viewdef = viewdefs[_.first(altviews).viewdef])

        var definition = viewdef.find('definition').text();
        var actual_viewdef = definition ? viewdefs[definition] : viewdef;

        var formNumber = formCounter++;
        var doingFormTable = viewdef.attr('type') === 'formtable';
        var processCell = _.bind(specifyformcells, null, formNumber, doingFormTable);

        var wrapper = $(templates.viewwrapper({ viewModel: getModelFromViewdef(actual_viewdef) }));

        (doingFormTable ? buildFormTable : buildForm)(formNumber, actual_viewdef, processCell).appendTo(wrapper);
        wrapper.addClass('specify-form-type-' + viewdef.attr('type'));
        return wrapper;
    }

    function getView(name) {
        return $.getJSON('/context/view.json', {name: name});
    }

    var specifyform = {
        parseSpecifyProperties: parseSpecifyProperties,

        getModelForView: function(viewName) {
            return schema.getModel(getModelFromView(viewName));
        },

        buildViewByName: function (viewName, defaultType) {
            return getView(viewName).pipe(function(view) { return buildView(view, defaultType); });
        },

        buildSubView: function (node) {
            var defaultType = node.data('specify-viewtype') === 'table' ? 'formtable' : 'form';
            return getView(node.data('specify-viewname')).pipe(function(view) {
                var form = buildView(view, defaultType);
                form.find('.specify-form-header:first, :submit, :button[value="Delete"]').remove();
                return form;
            });
        },

        isSubViewButton: function (node) {
            return node.is('.specify-subview-button');
        }
    };

    return specifyform;
});
