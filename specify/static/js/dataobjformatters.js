define([
    'jquery', 'specifyapi', 'whenall',
    'text!/static/resources/dataobj_formatters.xml'
], function($, api, whenAll, xml) {
    "use strict";
    var formatters = $.parseXML(xml);

    function dataobjformat(resource, formatter) {
        return !resource ? $.when(null) : resource.fetchIfNotPopulated().pipe(function() {
            formatter = formatter || resource.specifyModel.name;
            var sw = $('format[name="' + formatter + '"]', formatters).find('switch');
            // external dataobjFormatters not supported
            if (!sw.length || sw.find('external').length) return null;

            // doesn't support switch fields that are in child objects
            var fields = (sw.attr('field') ?
                          sw.find('fields[value="' + resource.get(sw.attr('field')) + '"]:first') :
                          sw.find('fields:first')).find('field');

            var deferreds = fields.map(function () {
                var field = $(this);
                var formatter = field.attr('formatter'); // hope it's not circular!
                var fieldName = field.text();
                var fetch = resource.rget(fieldName, true);
                return !formatter ? fetch : fetch.pipe(function(resource) {
                    return dataobjformat(resource, formatter);
                });
            });

            return whenAll(deferreds).pipe(function (data) {
                var result = [];
                fields.each(function (index) {
                    var field = $(this);
                    field.attr('sep') && result.push(field.attr('sep'));
                    result.push(data[index]);
                });
                return result.join('');
            });
        });
    }

    return dataobjformat;
});
