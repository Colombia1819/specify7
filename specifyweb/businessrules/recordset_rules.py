from .orm_signal_handler import orm_signal_handler
from specifyweb.specify.models import Recordsetitem

@orm_signal_handler('post_delete')
def remove_from_recordsets(sender, obj):
    if not hasattr(sender, 'table_id'): return
    rsis = Recordsetitem.objects.filter(
        recordset__dbtableid=sender.table_id,
        recordid=obj.id)
    rsis.delete()

@orm_signal_handler('pre_save', 'Recordset')
def recordset_pre_save(recordset):
    if recordset.specifyuser_id is None:
        recordset.specifyuser = recordset.createdbyagent.specifyuser

