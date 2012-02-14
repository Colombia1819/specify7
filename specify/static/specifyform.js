(function (specify, $, undefined) {
    specify.language = "en";

    // Given a DOM containing alternative localizations,
    // return the one for the language selected above,
    // or failing that, for "en", or failing that,
    // just return the first one.
    var getLocalizedStr = function(alternatives) {
        var str = $(alternatives)
            .children('str[language="' + specify.language + '"]');
        if (str.length < 1) {
            str = $(alternatives)
                .children('str[language="en"]');
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
        $(columnDef.split(',')).each(function(i, def) {
            if (i%2==0) {
                var col = $('<col>').appendTo(table);
                var width = /(\d+)px/.exec(def);
                width && col.attr('width', width[1]+'px');
            }
        });
        return table;
    }

    // Return a <form> DOM node containing the processed view.
    // Subviews result in recursive calls where depth is
    // incremented each time
    // [views] is an object mapping view names to <viewdef> DOM nodes
    // [schemaLocalization] is a DOM structure
    specify.processView = function (viewName, views, schemaLocalization, depth, suppressHeader) {
        if (!views[viewName]) return $('<form>');
        depth = depth || 1;
        var view = $(views[viewName]);
        var viewModel = view.attr('class').split('.').pop();

        // Search the schema_localization DOM for the given modelName.
        function getLocalizationForModel(modelName) {
            return $(schemaLocalization)
                .find('container[name="'+modelName.toLowerCase()+'"]').first();
        }

        var getSchemaInfoFor = function(fieldname) {
            var path = fieldname.split('.');
            var field = path.pop();
            var model = path.pop();
            var localization = model ?
                getLocalizationForModel(model) :
                getLocalizationForModel(viewModel);

            return $(localization).children('items')
                .children('item[name="'+field+'"]');
        };

        var getLocalizedLabelFor = function (fieldname) {
            return getLocalizedStr(getSchemaInfoFor(fieldname).children('names'));
        };

        var processCell = function(cellNode) {
            var cell = $(cellNode);
            var byType = {
                label: function() {
                    var givenLabel = cell.attr('label');
                    var labelfor = cell.attr('labelfor');
                    var forCellName = view
                        .find('cell[id="'+labelfor+'"]')
                        .first().attr('name');
                    var localizedLabel = getLocalizedLabelFor(forCellName);
                    var label = $('<label>');
                    if (givenLabel) {
                        label.text(givenLabel);
                    } else if (localizedLabel) {
                        label.text(localizedLabel);
                    } else if (forCellName) {
                        label.text(forCellName);
                    }
                    return $('<td>').append(label).addClass('form-label');
                },
                field: function() {
                    var td = $('<td>');
                    var fieldName = cell.attr('name');
                    var byUIType =  {
                        checkbox: function() {
                            var givenLabel = cell.attr('label');
                            var localizedLabel = getLocalizedLabelFor(fieldName);
                            control = $('<input type="checkbox" />').appendTo(td);
                            if (givenLabel)td.append($('<label>').text(givenLabel));
                            else if (localizedLabel) td.append($('<label>').text(localizedLabel));
                            return control;
                        },
                        textareabrief: function() {
                            control = $('<textarea>)').attr('rows', cell.attr('rows')).appendTo(td);
                            return control;
                        },
                        combobox: function() {
                            var pickListName = getSchemaInfoFor(fieldName).attr('pickListName');
                            control = $('<select>').appendTo(td);
                            pickListName && control.addClass('specify-picklist:' + pickListName);
                            return control;
                        },
                        querycbx: function() {
                            control = $('<select>').appendTo(td);
                            return control;
                        },
                        text: function() {
                            control = $('<input type="text" />').appendTo(td);
                            return control;
                        },
                        other: function() {
                            td.text("unsupported uitype: " + cell.attr('uitype'));
                        }
                    };
                    var control = (byUIType[cell.attr('uitype')] || byUIType.other)();
                    control && control.attr('name', fieldName).addClass('specify-field');
                    return td;
                },
                separator: function() {
                    var label = cell.attr('label');
                    var elem = label ? $('<h'+(depth+1)+'>').text(label) : $('<hr>');
                    return $('<td>').append(elem.addClass('separator'));
                },
                subview: function() {
                    var td = $('<td>');
                    var fieldName = cell.attr('name');
                    var schemaInfo = getSchemaInfoFor(fieldName);
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
                    td.addClass('specify-field-name:' + fieldName);
                    td.addClass('specify-view-name:' + cell.attr('viewname'));
                    return td;
                },
                panel: function() {
                    var table = processColumnDef(cell.attr('coldef'));
                    cell.children('rows').children('row').each(
                        function(i, row) {
                            var tr = $('<tr>').appendTo(table);
                            $(row).children('cell').each(
                                function(i, cell) {
                                    tr.append(processCell(cell));
                                });
                        });
                    return $('<td>').append(table);
                },
	        command: function() {
		    var button = $('<input type="submit">').attr({
		        value: cell.attr('label'),
		        name: cell.attr('name')
		    });
		    return $('<td>').append(button);
	        },
                other: function() {
                    return $('<td>').text("unsupported cell type: " + cell.attr('type'));
                }
            };

            var td = (byType[cell.attr('type')] || byType.other)();
            var colspan = cell.attr('colspan');
            colspan && td.attr('colspan', Math.ceil(parseInt(colspan)/2));
            return td;
        };

        var table = processColumnDef(view.find('columnDef').first().text());

        // Iterate over the rows and cells of the view
        // processing each in turn and appending them
        // to the generated <table>.
        view.children('rows').children('row').each(function(i, row) {
            var tr = $('<tr>').appendTo(table);
            $(row).children('cell').each(function(i, cell) {
                tr.append(processCell(cell));
            });
        });

        if (!suppressHeader){
            var localizedName = getLocalizedStr(
                getLocalizationForModel(viewModel).children('names')
            ) || view.attr('name');

            return $('<form>').append($('<h'+depth+'>').text(localizedName)).append(table);
        } else {
            return $('<form>').append(table);
        }
    }

} (window.specify = window.specify || {}, jQuery));



// Main entry point.
$(function () {
    var schemaLocalization;
    var uri = "http://localhost:8000/api/specify/collectionobject/102/";

    // Processes the viewset DOM to create an object
    // mapping viewDef names to the viewDef DOM nodes.
    // Allows the views to be merrged easily.
    function breakOutViews(viewset) {
        var views = {};
        $(viewset).find('viewdef').each(function(i, view) {
            views[$(view).attr('name')] = view;
        });
        return views;
    }

    $.get('/static/schema_localization.xml', function(data) {
        schemaLocalization = data;
        loadViews();
    });

    // Load all views and merge them such that
    // those listed first are overriden by
    // the ones listed later.
    var loadViews = function() {
        var viewsetNames = [
            //        'system.views.xml',
            //        'editorpanel.views.xml',
            //        'preferences.views.xml',
            //        'global.views.xml',
            //        'search.views.xml',
            '/static/views.xml'
            //        'manager.botany.views.xml',
        ];

        var viewsets = {}, completed = 0;
        $(viewsetNames).each(function(i, name) {
            $.get(name, function(viewset) {
                completed++;
                viewsets[name] = viewset;
                if (completed == viewsetNames.length) {
                    var orderedViews = $.merge(
                        [{}], viewsetNames.map(function(name) {
                            return breakOutViews(viewsets[name]);
                        }));
                    var views = $.extend.apply($, orderedViews);
                    $('body').append(specify.populateForm(view, uri, views, schemaLocalization));
                }
            });
        });
    };
});
