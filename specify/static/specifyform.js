(function (specify, $, undefined) {
    "use strict";
    var schemaLocalization, viewDefs,
    viewsetNames = [
        //        'system.views.xml',
        //        'editorpanel.views.xml',
        //        'preferences.views.xml',
        //        'global.views.xml',
        //        'search.views.xml',
        '/static/views.xml'
               // '/static/vascplant.views.xml',
    ];

    specify.language = "en";

    // Given a DOM containing alternative localizations,
    // return the one for the language selected above,
    // or failing that, for "en", or failing that,
    // just return the first one.
    var getLocalizedStr = function(alternatives) {
        var str = $(alternatives).children('str[language="' + specify.language + '"]');
        if (str.length < 1) {
            str = $(alternatives).children('str[language="en"]');
        }
        if (str.length < 1) {
            str = $(alternatives).children('str').first();
        }
        return str.children('text').text().replace(/\\n/g, "\n");
    };

    // Return a table DOM node with <col> defined based
    // on the columnDef attr of a viewDef.
    function processColumnDef(columnDef) {
        var table = $('<table>');
        $(columnDef.split(',')).each(function(i) {
            if (i%2 === 0) {
                var col = $('<col>').appendTo(table),
                width = /(\d+)px/.exec(this);
                width && col.attr('width', width[1]+'px');
            }
        });
        return table;
    }

    // Return a <form> DOM node containing the processed view.
    specify.processView = function (viewName, depth, suppressHeader) {
        if (!viewDefs[viewName.toLowerCase()]) { return $('<form>'); }
        depth = depth || 1;
        var view = $(viewDefs[viewName.toLowerCase()]),
        viewModel = view.attr('class').split('.').pop();

        // Search the schema_localization DOM for the given modelName.
        function getLocalizationForModel(modelName) {
            return $(schemaLocalization).find('container[name="'+modelName.toLowerCase()+'"]').first();
        }

        var getSchemaInfoFor = function(fieldname) {
            var path = fieldname.split('.'), field = path.pop(), model = path.pop(),
            localization = model ? getLocalizationForModel(model) : getLocalizationForModel(viewModel);
            return $(localization).children('items').children('item[name="'+field+'"]');
        },

        getLocalizedLabelFor = function (fieldname) {
            return getLocalizedStr(getSchemaInfoFor(fieldname).children('names'));
        },

        processCell = function(cellNode) {
            var cell = $(cellNode),
            byType = {
                label: function() {
                    var labelfor = cell.attr('labelfor'),
                    forCellName = view.find('cell[id="'+labelfor+'"]').first().attr('name'),
                    label = $('<label>');
                    if (cell.attr('label') !== undefined) {
                        label.text(cell.attr('label'));
                    } else {
                        var localizedLabel = getLocalizedLabelFor(forCellName);
                        label.text(localizedLabel || forCellName);
                    }
                    return $('<td>').append(label).addClass('form-label');
                },
                field: function() {
                    var td = $('<td>'),
                    fieldName = cell.attr('name'),
                    byUIType = {
                        checkbox: function() {
                            var control = $('<input type="checkbox">').appendTo(td),
                            label = cell.attr('label');
                            if (label === undefined) { label = getLocalizedLabelFor(fieldName); }
                            label && td.append($('<label>').text(label));
                            return control;
                        },
                        textareabrief: function() {
                            var control = $('<textarea>)').attr('rows', cell.attr('rows')).appendTo(td);
                            return control;
                        },
                        combobox: function() {
                            var pickListName = getSchemaInfoFor(fieldName).attr('pickListName'),
                            control = $('<select>').appendTo(td);
                            pickListName && control.attr('data-specify-picklist', pickListName);
                            return control;
                        },
                        querycbx: function() {
                            return $('<input type="text">').appendTo(td).addClass('specify-querycbx');
                        },
                        text: function() {
                            return $('<input type="text">').appendTo(td);
                        },
                        formattedtext: function() {
                            return $('<input type="text">').appendTo(td);
                        },
                        label: function() {
                            return $('<input type="text" readonly>').appendTo(td);
                        },
                        other: function() {
                            td.text("unsupported uitype: " + cell.attr('uitype'));
                        }
                    },
                    initialize = cell.attr('initialize'),
                    control = (byUIType[cell.attr('uitype')] || byUIType.other)();
                    control && control.attr('name', fieldName).addClass('specify-field');
                    if (initialize && control) { control.attr('data-specify-initialize', initialize); }
                    return td;
                },
                separator: function() {
                    var label = cell.attr('label'),
                    elem = label ? $('<h'+(depth+1)+'>').text(label) : $('<hr>');
                    return $('<td>').append(elem.addClass('separator'));
                },
                subview: function() {
                    var td = $('<td>'),
                    fieldName = cell.attr('name'),
                    schemaInfo = getSchemaInfoFor(fieldName);
                    switch (schemaInfo.attr('type')) {
                    case 'OneToMany':
                        var localizedName = getLocalizedStr(schemaInfo.children('names'));
                        td.append($('<h'+(depth+1)+'>').text(localizedName));
                        td.addClass('specify-one-to-many');
                        break;
                    case 'ManyToOne':
                        td.addClass('specify-many-to-one');
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
            colspan && td.attr('colspan', Math.ceil(parseInt(colspan)/2));
            return td;
        },

        table = processColumnDef(view.find('columnDef').first().text());

        // Iterate over the rows and cells of the view
        // processing each in turn and appending them
        // to the generated <table>.
        view.children('rows').children('row').each(function () {
            var tr = $('<tr>').appendTo(table);
            $(this).children('cell').each(function () { processCell(this).appendTo(tr); });
        });

        if (!suppressHeader){
            var localizedName = getLocalizedStr(
                getLocalizationForModel(viewModel).children('names')
            ) || view.attr('name');

            return $('<form>').append($('<h'+depth+'>').text(localizedName)).append(table);
        } else {
            return $('<form>').append(table);
        }
    };

    // Processes the viewset DOM to create an object
    // mapping viewDef names to the viewDef DOM nodes.
    // Allows the views to be merged easily.
    function breakOutViews(viewset) {
        var views = {};
        $(viewset).find('view').each(function () {
            var view = $(this);
            view.find('altview').each(function () {
                var viewdefName = $(this).attr('viewdef'),
                viewdef = $(viewset).find('viewdef[name="'+viewdefName+'"][type="form"]').first();
                viewdef.is("*") && (views[view.attr('name').toLowerCase()] = viewdef);
            });
        });
        return views;
    }

    specify.loadViews = function() {
        var loaders = [$.get('/static/schema_localization.xml',
                             function(data) { schemaLocalization = data; })
                      ],
        viewsets = {};
        $(viewsetNames).each(function (i, name) {
            loaders.push($.get(name, function(viewset) { viewsets[name] = viewset; }));
        });
        return $.when.apply($, loaders).then(function() {
            var orderedViews = viewsetNames.map(
                function(name) { return breakOutViews(viewsets[name]); });

            viewDefs = $.extend.apply($, $.merge([{}], orderedViews));
        }).promise();
    };

} (window.specify = window.specify || {}, jQuery));
