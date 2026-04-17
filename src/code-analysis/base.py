
##### Instrumentation Logic #####

import inspect
import json
import types
import uuid

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

    def __getattr__(self, name):
        return getattr(self._value, name)

    def __setattr__(self, name, value):
        setattr(self._value, name, value)

    def __repr__(self): return repr(self._value)
    def __str__(self): return str(self._value)
    def __format__(self, spec): return format(self._value, spec)

    def _to_json(self):
        return {
            'identifier': self._identifier,
            'value':      self._value
        }

def _execution_checkpoint(
    sync_with_controller: bool,
    line_number_range: tuple[int, int] | None,
    scope_locals: dict,
    frame: types.FrameType
):
    try:
        def get_frame_identifier(frame: types.FrameType):
            if '_frame_identifier' not in frame.f_locals:
                frame.f_locals['_frame_identifier'] = str(uuid.uuid4())
            return frame.f_locals['_frame_identifier']

        def json_default(input_object):
            if isinstance(input_object, TraceableListItem):
                return input_object._value
            return str(input_object)

        scope_globals: dict = globals()

        if 'SORTING_LIST_VARIABLE_NAME' in scope_globals:
            for i, item in enumerate(scope_globals['SORTING_LIST_VARIABLE_NAME']):
                if not isinstance(item, TraceableListItem):
                    scope_globals['SORTING_LIST_VARIABLE_NAME'][i] = TraceableListItem(item)

        if not sync_with_controller:
            return

        scope_locals_copy: dict = scope_locals.copy()

        keys_to_clean_up: list[str] = [
            '__builtins__',
            'inspect',
            'json',
            'types',
            'uuid',
            'TraceableListItemMeta',
            'TraceableListItem',
            '_frame_identifier',
            '_execution_checkpoint',
            'SORTING_LIST_VARIABLE_NAME'
        ]
        for key in keys_to_clean_up:
            if key in scope_locals_copy:
                del scope_locals_copy[key]

        checkpoint: dict = {
            'lineRange': None if line_number_range is None else {
                'start': line_number_range[0],
                'end': line_number_range[1]
            },
            'scopeLocals': scope_locals_copy,
            'functionIdentifier': frame.f_code.co_qualname,
            'frameIdentifier': get_frame_identifier(frame),
            'parentFrameIdentifier': get_frame_identifier(frame.f_back),
            'sortingList': None
        }

        if 'SORTING_LIST_VARIABLE_NAME' in scope_globals:
            checkpoint['sortingList'] = [
                item._to_json() for item in scope_globals['SORTING_LIST_VARIABLE_NAME']
            ]

        with open('/execution-control/checkpoint.json', 'w') as checkpoint_file:
            json.dump(checkpoint, checkpoint_file, indent='\t', default=json_default)

        input()
    finally:
        del frame

try:
    ##### User Code #####
#USER_CODE_INSERTION_HANDLE#
except KeyboardInterrupt:
    pass
