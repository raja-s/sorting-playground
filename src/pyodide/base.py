
##### Instrumentation Logic #####

import json

class TraceableListItemMeta(type):
    def __new__(metaclass, name, base_classes, attributes):
        new_class = super().__new__(metaclass, name, base_classes, attributes)

        special_method_names = (
            '__add__', '__sub__', '__mul__', '__truediv__', '__floordiv__',
            '__mod__', '__pow__', '__and__', '__or__', '__xor__',
            '__lt__', '__le__', '__eq__', '__ne__', '__gt__', '__ge__',
            '__call__', '__len__', '__getitem__', '__setitem__', '__iter__',
            '__contains__', '__hash__', '__bool__', '__int__', '__float__',
            '__index__', '__reversed__', '__abs__', '__neg__', '__pos__'
        )

        def make_delegate(method_name):
            def delegate(self, other=None):
                self_value = object.__getattribute__(self, "_value")

                if other is not None:
                    try:
                        other_value = object.__getattribute__(other, "_value")
                    except AttributeError:
                        other_value = other

                    return getattr(self_value, method_name)(other_value)

                return getattr(self_value, method_name)()

            return delegate

        for special_method_name in special_method_names:
            if special_method_name not in attributes:
                setattr(
                    new_class,
                    special_method_name,
                    make_delegate(special_method_name)
                )

        return new_class

class TraceableListItem(metaclass=TraceableListItemMeta):
    __slots__ = ('_identifier', '_value')

    _next_item_identifier: int = 0

    def __init__(self, value):
        object.__setattr__(self, '_identifier', TraceableListItem._next_item_identifier)
        object.__setattr__(self, '_value', value)

        TraceableListItem._next_item_identifier += 1

    @property
    def __class__(self):
        return self._value.__class__

    def __getattr__(self, name):
        return getattr(self._value, name)

    def __setattr__(self, name, value):
        setattr(self._value, name, value)

    def __repr__(self): return repr(self._value)
    def __str__(self): return str(self._value)
    def __format__(self, spec): return format(self._value, spec)

    def __to_json__(self):
        return {
            'identifier': self._identifier,
            'value':      self._value
        }

def save_execution_checkpoint_and_pause(
    start_line_number: int | None,
    end_line_number: int | None,
    scope_locals: dict
):
    scope_locals_copy = scope_locals.copy()

    keys_to_clean_up = [
        '__builtins__',
        'json',
        'TraceableListItemMeta',
        'TraceableListItem',
        'save_execution_checkpoint_and_pause',
        'SORTING_LIST_VARIABLE_NAME'
    ]
    for key in keys_to_clean_up:
        if key in scope_locals_copy:
            del scope_locals_copy[key]

    checkpoint = {
        'startLineNumber': start_line_number,
        'endLineNumber': end_line_number,
        'scopeLocals': scope_locals_copy,
        'sortingList': None
    }

    scope_globals: dict = globals()

    if 'SORTING_LIST_VARIABLE_NAME' in scope_globals:
        for i, item in enumerate(scope_globals['SORTING_LIST_VARIABLE_NAME']):
            if not isinstance(item, TraceableListItem):
                scope_globals['SORTING_LIST_VARIABLE_NAME'][i] = TraceableListItem(item)

        checkpoint['sortingList'] = [
            item.__to_json__()
                for item in scope_globals['SORTING_LIST_VARIABLE_NAME']
        ]

    with open('/execution-control/checkpoint.json', 'w') as checkpoint_file:
        json.dump(checkpoint, checkpoint_file, indent='\t', default=str)

    input()

try:
    ##### User Code #####
#USER_CODE_INSERTION_HANDLE#
except KeyboardInterrupt:
    pass
