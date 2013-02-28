Ext.Loader.setConfig({enabled:true});
//Ext.tip.QuickTipManager.init();
Ext.application({
    name: 'SpThinClient', 
    appFolder: '/static/app',   
    id: 'sp-thinclient-app-obj',
    autoCreateViewport: true,

    controllers: ['Welcome', 'Data', 'ExpressSearch', 'Query'],

    init: function () {
	console.info("ExtJS app.init()");
	//Ext.getBody().setHTML("");

	//load user settings from local storage
	/*
	Ext.state.Manager.setProvider(new Ext.state.LocalStorageProvider({
	    prefix: Ext.getStore('SettingsStore').getAt(0).get('portalInstance')}));
	 */
    }
});
