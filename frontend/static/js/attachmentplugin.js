define([
    'jquery', 'underscore', 'specifyapi', 'uiplugin', 'attachments', 'jquery-ui'
], function($, _, api, UIPlugin, attachments) {
    "use strict";

    return UIPlugin.extend({
        events: {
            'change :file': 'fileSelected',
            'click .specify-attachment-display a': 'openOriginal'
        },
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
            self.$el.append('<form enctype="multipart/form-data"><input type="file" name="file"></form>');
        },
        fileSelected: function(evt) {
            var files = this.$(':file').get(0).files;
            if (files.length === 0) return;
            this.startUpload(files[0]);
        },
        startUpload: function(file) {
            var self = this;
            var formData = new FormData(self.$('form').get(0));

            self.progressBar = $('<div class="attachment-upload-progress">').progressbar();

            self.progressDialog = $('<div>', {title: 'Uploading'})
                .appendTo(self.el)
                .append(self.progressBar)
                .dialog({ modal:true });

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
                self.displayAttachment(attachment);
                self.progressDialog.dialog('close');
            });
        },
        displayAttachment: function(attachment) {
            var self = this;
            self.$el.empty().append('<div class="specify-attachment-display">');

            attachments.getThumbnail(attachment).done(function(img) {
                $('<a>').append(img).appendTo(self.$('.specify-attachment-display'));
            });
        },
        openOriginal: function(evt) {
            evt.preventDefault();
            this.model.rget('attachment', true).done(function(attachment) {
                attachments.openOriginal(attachment);
            });
        }
    });
});
