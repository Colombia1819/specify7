from exceptions import BusinessRuleException
from django.db.models import Max
from orm_signal_handler import orm_signal_handler
from specify.models import Collector

@orm_signal_handler('pre_save', 'Collector')
def collector_pre_save(collector):
    if collector.id is None:
        if collector.ordernumber is None:
            # this should be atomic, but whatever
            others = Collector.objects.filter(collectingevent=collector.collectingevent)
            top = others.aggregate(Max('ordernumber'))['ordernumber__max'] or 0
            collector.ordernumber = top + 1

@orm_signal_handler('pre_save', 'Collector')
def division_cannot_be_null(collector):
    if collector.division is None:
        raise BusinessRuleException("collector.division cannot be null")

