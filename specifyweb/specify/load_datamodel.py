from xml.etree import ElementTree
import os

from django.conf import settings

class Datamodel(object):
    def get_table(self, tablename):
        tablename = tablename.lower()
        for table in self.tables:
            if table.name.lower() == tablename:
                return table

class Table(object):
    system = False

    @property
    def name(self):
        return self.classname.split('.')[-1]

    @property
    def django_name(self):
        return self.name.capitalize()

    def get_field(self, fieldname):
        fieldname = fieldname.lower()
        for field in self.fields + self.relationships:
            if field.name.lower() == fieldname:
                return field

    @property
    def attachments_field(self):
        attachments = self.get_field('attachments') or self.get_field(self.name + 'attachments')
        if attachments:
            assert isinstance(attachments, Relationship), "attachments field must be relationship"
        return attachments

    @property
    def is_attachment_jointable(self):
        return self.name.endswith('attachment')


class Field(object):
    pass

class Relationship(object):
    dependent = False


def make_table(tabledef):
    table = Table()
    table.classname = tabledef.attrib['classname']
    table.table = tabledef.attrib['table']
    table.tableId = int(tabledef.attrib['tableid'])
    table.idColumn = tabledef.find('id').attrib['column']
    table.idFieldName = tabledef.find('id').attrib['name']

    display = tabledef.find('display')
    if display is not None:
        table.view = display.attrib.get('view', None)
        table.searchDialog = display.attrib.get('searchdlg', None)

    table.fields = [make_field(fielddef) for fielddef in tabledef.findall('field')]
    table.relationships = [make_relationship(reldef) for reldef in tabledef.findall('relationship')]
    table.fieldAliases = [make_field_alias(aliasdef) for aliasdef in tabledef.findall('fieldalias')]
    return table

def make_field(fielddef):
    field = Field()
    field.name = fielddef.attrib['name']
    field.column = fielddef.attrib['column']
    field.indexed = fielddef.attrib['indexed'] == "true"
    field.unique = fielddef.attrib['unique'] == "true"
    field.required = fielddef.attrib['required'] == "true"
    field.type = fielddef.attrib['type']
    if 'length' in fielddef.attrib:
        field.length = int(fielddef.attrib['length'])
    return field

def make_relationship(reldef):
    rel = Relationship()
    rel.name = reldef.attrib['relationshipname']
    rel.type = reldef.attrib['type']
    rel.required = (reldef.attrib['required'] == "true")
    rel.relatedModelName = reldef.attrib['classname'].split('.')[-1]
    if 'columnname' in reldef.attrib:
        rel.column = reldef.attrib['columnname']
    if 'othersidename' in reldef.attrib:
        rel.otherSideName = reldef.attrib['othersidename']
    return rel

def make_field_alias(aliasdef):
    alias = dict(aliasdef.attrib)
    return alias

def load_datamodel():
    datamodeldef = ElementTree.parse(os.path.join(settings.SPECIFY_CONFIG_DIR, 'specify_datamodel.xml'))

    datamodel = Datamodel()
    datamodel.tables = [make_table(tabledef) for tabledef in datamodeldef.findall('table')]

    flag_dependent_fields(datamodel)
    flag_system_tables(datamodel)

    return datamodel

def flag_dependent_fields(datamodel):
    for name in dependent_fields:
        tablename, fieldname = name.split('.')
        table = datamodel.get_table(tablename)
        field = table.get_field(fieldname)
        assert isinstance(field, Relationship), 'Expected relationship for %s, got %r, in %r' % (name, field, table)
        field.dependent = True

    for table in datamodel.tables:
        table = datamodel.get_table(tablename)
        if table.is_attachment_jointable:
            table.get_field('attachment').dependent = True
        if table.attachments_field:
            table.attachments_field.dependent = True

def flag_system_tables(datamodel):
    for name in system_tables:
        datamodel.get_table(name).system = True

    for table in datamodel.tables:
        if table.is_attachment_jointable:
            table.system = True
        if table.name.endswith('treedef') or table.name.endswith('treedefitem'):
            table.system = True

dependent_fields = {
    'Accession.accessionagents',
    'Accession.accessionauthorizations',
    'Agent.addresses',
    'Agent.variants',
    'Agent.groups',
    'Agent.agentgeographies',
    'Agent.agentspecialties',
    'Borrow.borrowagents',
    'Borrow.borrowmaterials',
    'Borrowmaterial.borrowreturnmaterials',
    'Collectingevent.collectors',
    'Collectingevent.collectingeventattribute',
    'Collectingevent.collectingeventattrs',
    'Collectingtrip.fundingagents',
    'Collectionobject.determinations',
    'Collectionobject.dnasequences',
    'Collectionobject.collectionobjectattribute',
    'Collectionobject.collectionobjectattrs',
    'Collectionobject.collectionobjectcitations',
    'Collectionobject.conservdescriptions',
    'Collectionobject.dnasequences',
    'Collectionobject.exsiccataitems',
    'Collectionobject.otheridentifiers',
    'Collectionobject.treatmentevents',
    'Collectionobject.preparations',
    'Commonnametx.citations',
    'Conservdescription.events',
    'Dnasequence.dnasequencingruns',
    'Dnasequencingrun.citations',
    'Deaccession.deaccessionagents',
    'Deaccession.deaccessionpreparations',
    'Determination.determinationcitations',
    'Exchangein.exchangeinpreps',
    'Exchangeout.exchangeoutpreps',
    'Exsiccata.exsiccataitems',
    'Fieldnotebook.pagesets',
    'Fieldnotebookpageset.pages',
    'Gift.giftagents',
    'Gift.giftpreparations',
    'Latlonpolygon.points',
    'Loan.loanagents',
    'Loan.loanpreparations',
    'Loanpreparation.loanreturnpreparations',
    'Locality.localitydetails',
    'Locality.geocoorddetails',
    'Locality.latlonpolygons',
    'Locality.localitycitations',
    'Locality.localitynamealiass',
    'Picklist.picklistitems',
    'Preptype.attributedefs',
    'Preparation.preparationattribute',
    'Preparation.preparationattrs',
    'Referencework.authors',
    'Repositoryagreement.repositoryagreementagents',
    'Repositoryagreement.repositoryagreementauthorizations',
    'Spquery.fields',
    'Taxon.commonnames',
    'Taxon.taxoncitations',
}


system_tables = {
    'Attachment',
    'Attachmentimageattribute',
    'Attachmentmetadata',
    'Attachmenttag',
    'Attributedef',
    'Autonumberingscheme',
    'Collectionreltype',
    'Collectionrelationship',
    'Datatype',
    'Morphbankview',
    'Otheridentifier',
    'Picklist',
    'Picklistitem',
    'Recordset',
    'Recordsetitem',
    'Spappresource',
    'Spappresourcedata',
    'Spappresourcedir',
    'Spauditlog',
    'Spauditlogfield',
    'Spexportschema',
    'Spexportschemaitem',
    'Spexportschemaitemmapping',
    'Spexportschemamapping',
    'Spfieldvaluedefault',
    'Splocalecontainer',
    'Splocalecontaineritem',
    'Splocaleitemstr',
    'Sppermission',
    'Spprincipal',
    'Spquery',
    'Spqueryfield',
    'Spreport',
    'Sptasksemaphore',
    'Spversion',
    'Spviewsetobj',
    'Spvisualquery',
    'Specifyuser',
    'Workbench',
    'Workbenchdataitem',
    'Workbenchrow',
    'Workbenchrowexportedrelationship',
    'Workbenchrowimage',
    'Workbenchtemplate',
    'Workbenchtemplatemappingitem',
}
