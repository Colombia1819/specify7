define([
    'jquery', 'underscore', 'specifyapi', 'uiplugin', 'jquery-ui'
], function($, _, api, UIPlugin) {
    "use strict";

    return UIPlugin.extend({
        render: function() {
            var self = this;
            var control = $('<div class="specify-attachment-container">');
            self.$el.replaceWith(control);
            self.setElement(control);

            if (self.model.isNew()) {
                self.addAttachment();
            } else {
                self.model.rget('attachment', true).done(function(attachment) {
                    self.displayAttachment(attachment);
                });
            }
            return this;
        },
        addAttachment: function() {
            var self = this;
            var form = '<form enctype="multipart/form-data"><input type="file" name="file"></form>';

            self.doingUpload = false;

            self.dialog = $('<div>', {title: 'Upload'}).append(form).appendTo(self.el).dialog({
                modal:true,
                buttons: {
                    'Ok': function() {
                        self.startUpload();
                        self.doingUpload = true;
                        self.dialog.dialog('close');
                    }
                },
                close: function() {
                    $(this).remove();
                    self.dialog = null;
                    self.doingUpload || self.model.destroy();
                }
            });

        },
        startUpload: function() {
            var self = this;
            var files = $(':file', self.dialog).get(0).files;
            var formData = new FormData(self.dialog.find('form').get(0));

            if (files.length === 0) return;
            var file = files[0];

            self.progressBar = $('<div class="attachment-upload-progress">').progressbar();

            self.progressDialog = $('<div>', {title: 'Uploading'})
                .appendTo(self.el)
                .append(self.progressBar)
                .dialog({
                    modal:true
                });

            $.get('/attachment_gw/get_upload_params/', {filename: file.name})
                .done(function(uploadParams) {
                    formData.append('token', uploadParams.token);
                    formData.append('store', uploadParams.attachmentlocation);
                    formData.append('type', "O");
                    formData.append('coll', "KUFishvoucher");

                    return $.ajax({
                        url: 'http://dhwd99p1.nhm.ku.edu:3080/fileupload',
                        type: 'POST',
                        data: formData,
                        processData: false,
                        contentType: false,
                        success: function() { self.uploadComplete(file, uploadParams.attachmentlocation); },
                        xhr: function() {
                            var xhr = $.ajaxSettings.xhr();
                            if (xhr.upload) {
                                xhr.upload.addEventListener('progress', function(evt) {
                                    self.uploadProgress(evt);
                                });
                            }
                            return xhr;
                        }
                    });
                });
        },
        uploadProgress: function (evt) {
            var self = this;
            if (evt.lengthComputable) {
                self.progressBar.progressbar('option', {
                    value: evt.loaded,
                    max: evt.total
                });
            } else {
                self.progressBar.progressbar('option', 'value', false);
            }
        },
        uploadComplete: function(file, attachmentLocation) {
            var self = this;
            var attachment = new (api.Resource.forModel('attachment'))({
                attachmentlocation: attachmentLocation,
                mimetype: file.type,
                origfilename: file.name
            });
            attachment.save().done(function() {
                self.model.set('attachment', attachment);
                self.model.save();
                self.displayAttachment(attachment);
                self.progressDialog.dialog('close');
            });
        },
        displayAttachment: function(attachment) {
            var self = this;

            $('<div class="specify-attachment-display">').appendTo(self.el);
            $.ajax({
                url: "http://dhwd99p1.nhm.ku.edu:3088/getfileref",
                data: {
                    coll: "KUFishvoucher",
                    type: "T",
                    filename: attachment.get('attachmentlocation'),
                    scale: 256
                },
                success: function(src) {
                    $('<img>', {src: src, style: 'vertical-align: middle; max-width:256px; max-height:256px;'})
                        .appendTo(self.$('.specify-attachment-display'));
                },
                error: function(jqxhr) {
                    self.$('.specify-attachment-display').text("N/A");
                    jqxhr.errorHandled = true;
                }
            });

            // $('<a>', {href: src, 'class': 'specify-attachment-original'})
            //     .text('Original').appendTo(self.el).click(function(evt) {
            //         evt.preventDefault();
            //         window.open(src);
            //     });
        }
    });
});
