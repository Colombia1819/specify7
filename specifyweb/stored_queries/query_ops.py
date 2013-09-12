
class QueryOps(object):
    """Instances of this class turn Spqueryfield operation numbers into
    functions that turn lookup keys and predicate values into Django filters.
    """

    OPERATIONS = [
        # operation,      # op number
        'op_like',              # 0
        'op_equals',            # 1
        'op_greaterthan',       # 2
        'op_lessthan',          # 3
        'op_greaterthanequals', # 4
        'op_lessthanequals',    # 5
        'op_true',              # 6
        'op_false',             # 7
        'op_dontcare',          # 8
        'op_between',           # 9
        'op_in',                # 10
        'op_contains',          # 11
        'op_empty',             # 12
        'op_trueornull',        # 13
        'op_falseornull',       # 14
        ]

    def by_op_num(self, op_num):
        return getattr(self, self.OPERATIONS[op_num])

    def op_like(self, field, value):
        return field.like(value)

    def op_equals(self, field, value):
        return field == value

    def op_greaterthan(self, field, value):
        return field > value

    def op_lessthan(self, field, value):
        return field < value

    def op_greaterthanequals(self, field, value):
        return field >= value

    def op_lessthanequals(self, field, value):
        return field <= value

    def op_true(self, field, value):
        return field == True

    def op_false(self, field, value):
        return field == False

    def op_dontcare(self, field, value):
        return None

    def op_between(self, field, value):
        values = value.split(',')[:2]
        return field.between(*values)

    def op_in(self, field, value):
        values = value.split(',')
        return field.in_(values)

    def op_contains(self, field, value):
        return field.contains(value)

    def op_empty(self, field, value):
        return field == ''

    def op_trueornull(self, field, value):
        return (field == True) | (field == None)

    def op_falseornull(self, field, value):
        return (field == False) | (field == None)

