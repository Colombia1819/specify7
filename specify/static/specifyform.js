(function (specify, $, undefined) {
    "use strict";
    if (specify.forms) return;
    var self = specify.forms = {},
    views, viewdefs, formCounter = 0,
    $sl = specify.schemaLocalization,
    viewsetNames = [
        '/static/resources/system.views.xml',
        '/static/resources/editorpanel.views.xml',
        '/static/resources/preferences.views.xml',
        '/static/resources/common.views.xml',
        '/static/resources/global.views.xml',
        '/static/resources/search.views.xml',
        '/static/resources/fish.views.xml',
    ];

    self.getModelFromView = function(view) {
        if (!view.jquery) view = views[view.toLowerCase()];
        return view.attr('class').split('.').pop();
    };

    // Return a table DOM node with <col> defined based
    // on the columnDef attr of a viewdef.
    function processColumnDef(columnDef) {
        var table = $('<table>'),
        colgroup = $('<colgroup>').appendTo(table);
        $(columnDef.split(',')).each(function(i) {
            if (i%2 === 0) {
                var col = $('<col>').appendTo(colgroup),
                width = /(\d+)px/.exec(this);
                width && col.attr('width', width[1]+'px');
            }
        });
        return table;
    }

    function getDefaultViewdef(view, defaulttype) {
        if (defaulttype === 'table') {
            var viewdef;
            view.find('altview').each(function() {
                var vd = viewdefs[$(this).attr('viewdef').toLowerCase()];
                if (vd.attr('type') === 'formtable') viewdef = vd;
            });
            if (viewdef) return viewdef;
        }
        var defaultView = view.find('altview[default="true"]').first().attr('viewdef') ||
            view.find('altview').first().attr('viewdef');
        return viewdefs[defaultView.toLowerCase()];
    }

    function getModelFromViewdef(viewdef) {
        return viewdef.attr('class').split('.').pop();
    }

    // Return a <form> DOM node containing the processed view.
    self.processView = function (viewNameOrNode, depth, isRootForm) {
        depth = depth || 1;
        var formNumber = formCounter++, viewdef, viewName;
        if (viewNameOrNode.jquery) {
            // we got a subview node
            viewName = viewNameOrNode.data('specify-view-name');
            viewdef = viewdefs[viewNameOrNode.data('specify-viewdef').toLowerCase()];
        } else {
            // must be a view name
            viewName = viewNameOrNode;
        }
        if (!viewdef) {
            if (!views[viewName.toLowerCase()]) {
                return $('<p>').text('View "' + viewName + '" not found!');
            }
            viewdef = getDefaultViewdef($(views[viewName.toLowerCase()]));
        }

        var viewModel = getModelForViewdef(viewdef),
        doingFormTable = (viewdef.attr('type') === 'formtable'),
        result = doingFormTable ? $('<tr>') : $('<form>');
        result.prop('id', 'specify-form-' + formNumber);
        result.attr('data-specify-model', viewModel);

        var getSchemaInfoFor = function(fieldname, inViewdef) {
            var modelname = getModelFromViewdef(inViewdef || viewdef);
            return $sl.getSchemaInfoForField(fieldname, modelname);
        },

        getLocalizedLabelFor = function (fieldname, inViewdef) {
            var modelname = getModelFromViewdef(inViewdef || viewdef);
            return $sl.getLocalizedLabelForField(fieldname, modelname);
        },

        getLabelForCell = function (cell, inViewdef) {
            var modelname = getModelFromViewdef(inViewdef || viewdef);
            return cell.attr('label') ||
                $sl.getLocalizedLabelForField(cell.attr('name'), modelname);
//                || cell.attr('name');
        },

        getLabelCellText = function(cell, inViewdef) {
            if (cell.attr('label') !== undefined) {
                return cell.attr('label');
            } else {
                var labelfor = cell.attr('labelfor'),
                forCell = inViewdef.find('cell[id="'+labelfor+'"]'),
                return getLabelForCell(forCell, inViewdef);
            }
        },

        getFormTableCells = function(viewdef) {
            return viewdef.find('cell[type="field"], cell[type="subview"]');
        },

        buildFormTableHeader = function(viewdef) {
            var header = $('<thead>'), tr = $('<tr>').appendTo(header);
            getFormTableCells(viewdef).each(function () {
                tr.append($('<th>').text(getLabelForCell($(this), viewdef)));
            });
            return header;
        },

        processCell = function(cellNode) {
            var cell = $(cellNode),
            byType = {
                label: function() {
                    var label = $('<label>').text(getLabelCellText(cell));
                    var labelfor = cell.attr('labelfor');
                    labelfor && label.prop('for', 'specify-field-' + formNumber + '-' + labelfor);
                    return $('<td class="form-label">').append(label);
                },
                field: function() {
                    var td = $('<td>'),
                    fieldName = cell.attr('name'),
                    byUIType = {
                        checkbox: function() {
                            var control = $('<input type="checkbox">').appendTo(td);
                            if (doingFormTable) return control.attr('disabled', true);
                            var label = cell.attr('label');
                            if (label === undefined) { label = getLocalizedLabelFor(fieldName); }
                            label && td.append($('<label>').text(label));
                            return control;
                        },
                        textarea: function () {
                            if (doingFormTable)
                                return $('<input type="text" readonly>').appendTo(td);
                            var control = $('<textarea>)').appendTo(td);
                            cell.attr('rows') && control.attr('rows', cell.attr('rows'));
                            return control;
                        },
                        textareabrief: function() {
                            if (doingFormTable)
                                return $('<input type="text" readonly>').appendTo(td);
                            return $('<textarea>)').attr('rows', cell.attr('rows') || 1).appendTo(td);
                        },
                        combobox: function() {
                            var pickListName = getSchemaInfoFor(fieldName).attr('pickListName'),
                            isRequired = getSchemaInfoFor(fieldName).attr('isRequired') === 'true',
                            control = $('<select>').appendTo(td);
                            pickListName && control.attr('data-specify-picklist', pickListName);
                            isRequired && control.addClass('required');
                            control.attr('disabled', doingFormTable);
                            return control;
                        },
                        querycbx: function() {
                            return $('<input type="text">').appendTo(td)
                                .addClass('specify-querycbx').attr('readonly', doingFormTable);
                        },
                        text: function() {
                            return $('<input type="text">').appendTo(td).attr('readonly', doingFormTable);
                        },
                        formattedtext: function() {
                            return $('<input type="text">').appendTo(td).attr('readonly', doingFormTable);
                        },
                        label: function() {
                            return $('<input type="text" readonly>').appendTo(td);
                        },
                        plugin: function() {
                            return $('<input type="button" value="plugin" class="specify-uiplugin">')
                                .appendTo(td).attr('disabled', doingFormTable);
                        },
                        other: function() {
                            td.text("unsupported uitype: " + cell.attr('uitype'));
                        }
                    },
                    initialize = cell.attr('initialize'),
                    id = cell.attr('id'),
                    control = (byUIType[cell.attr('uitype')] || byUIType.other)();
                    if (control) {
                        control.attr('name', fieldName).addClass('specify-field');
                        id && control.prop('id', 'specify-field-' + formNumber + '-' + id);
                        initialize && control.attr('data-specify-initialize', initialize);
                    }
                    return td;
                },
                separator: function() {
                    var label = cell.attr('label'),
                    elem = label ? $('<h3>').text(label) : $('<hr>');
                    return $('<td>').append(elem.addClass('separator'));
                },
                subview: function() {
                    var td = $('<td>'),
                    props = specify.parseSpecifyProperties(cell.attr('initialize'));
                    if (props.btn === 'true') {
                        var button = $('<button type=button class="specify-subview-button">');
                        button.attr('data-specify-initialize', cell.attr('initialize'));
                        var icon = props.icon || self.getModelFromView(cell.attr('viewname'));
                        button.append($('<img src="' + specify.icons.getIcon(icon) + '" style="height: 20px">'));
                        button.attr('disabled', doingFormTable);
                        return td.append(button);
                    }
                    var fieldName = cell.attr('name'),
                    schemaInfo = getSchemaInfoFor(fieldName),
                    localizedName = $sl.getLocalizedStr(schemaInfo.children('names')),
                    header = $('<h3>').text(localizedName).appendTo(td);
                    switch (schemaInfo.attr('type')) {
                    case 'OneToMany':
                        td.addClass('specify-one-to-many');
                        var view = views[cell.attr('viewname').toLowerCase()];
                        if (view === undefined) {
                            td.text('View "' + cell.attr('viewname') + '" is undefined.');
                            break;
                        }
                        var modelName = view.attr('class').split('.').pop().toLowerCase();
                        header.append($('<a href="new/'+modelName+'/">Add</a>'));
                        var subviewdef = getDefaultViewdef(view, cell.attr('defaulttype'));
                        td.attr('data-specify-viewdef', subviewdef.attr('name'));
                        if (subviewdef.attr('type') === 'formtable') {
                            td.addClass('specify-formtable');
                            var viewdef = viewdefs[subviewdef.find('definition').text().toLowerCase()],
                            table = $('<table>').appendTo(td);
                            table.append(buildFormTableHeader(viewdef));
                            table.append('<tbody class="specify-form-container">');
                        } else { td.append('<div class="specify-form-container">'); }
                        break;
                    case 'ManyToOne':
                        td.addClass('specify-many-to-one');
                        td.append('<div class="specify-form-container">');
                        break;
                    }
                    td.attr('data-specify-field-name', fieldName);
                    td.attr('data-specify-view-name', cell.attr('viewname'));
                    return td;
                },
                panel: function() {
                    var table = processColumnDef(cell.attr('coldef'));
                    cell.children('rows').children('row').each(function () {
                        var tr = $('<tr>').appendTo(table);
                        $(this).children('cell').each(function() {
                            tr.append(processCell(this));
                        });
                    });
                    return $('<td>').append(table);
                },
	        command: function() {
		    var button = $('<input type="button">').attr({
		        value: cell.attr('label'),
		        name: cell.attr('name')
		    });
		    return $('<td>').append(button);
	        },
                other: function() {
                    return $('<td>').text("unsupported cell type: " + cell.attr('type'));
                }
            },

            td = (byType[cell.attr('type')] || byType.other)(),
            colspan = cell.attr('colspan');
            if (!doingFormTable && colspan) {
                td.attr('colspan', Math.ceil(parseInt(colspan)/2));
            }
            return td;
        };

        if (!doingFormTable) {
            var colDef = viewdef.find('columnDef[os="lnx"]').first().text() ||
                viewdef.find('columnDef').first().text();
            var table = processColumnDef(colDef);

            // Iterate over the rows and cells of the view
            // processing each in turn and appending them
            // to the generated <table>.
            viewdef.children('rows').children('row').each(function () {
                var tr = $('<tr>').appendTo(table);
                $(this).children('cell').each(function () { processCell(this).appendTo(tr); });
            });

            isRootForm && result.append($('<h2>').text(getLocalizedStr(
                $sl.getLocalizationForModel(viewModel).children('names')
            )));
            return result.append(table).append($('<input type="button" value="Delete">'));
        } else {
            var formViewdef = viewdefs[viewdef.find('definition').text().toLowerCase()];
            getFormTableCells(formViewdef).each(function () {
                processCell(this).appendTo(result);
            });
            return result.addClass("specify-formtable-row");
        }
    };

    // Processes the viewset DOM to create an object
    // mapping viewdef names to the viewdef DOM nodes.
    // Allows the views to be merged easily.
    function breakOutViews(viewset) {
        var views = {};
        $(viewset).find('view').each(function () {
            var view = $(this);
            views[view.attr('name').toLowerCase()] = view;
        });
        return views;
    }

    function breakOutViewdefs(viewset) {
        var viewdefs = {};
        $(viewset).find('viewdef').each(function () {
            var viewdef = $(this);
            viewdefs[viewdef.attr('name').toLowerCase()] = viewdef;
        });
        return viewdefs;
    }

    specify.addInitializer(function() {
        var viewsets = {},
        loaders = $(viewsetNames).map(function () {
            return $.get(name, function(viewset) { viewsets[name] = viewset; });
        });
        return $.when.apply($, loaders).then(function() {
            viewdefs = $.extend.apply($, $.merge([{}], viewsetNames.map(
                function(name) { return breakOutViewdefs(viewsets[name]); })));

            views = $.extend.apply($, $.merge([{}], viewsetNames.map(
                function(name) { return breakOutViews(viewsets[name]); })));
        }).promise();
    });

} (window.specify, jQuery));
