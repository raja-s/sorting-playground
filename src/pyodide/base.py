
##### Instrumentation Logic #####

import json

def enrich_list(input_list: list[int]) -> list[dict]:
    return [
        {
            'identifier': i,
            'value': input_list[i]
        }
            for i in range(len(input_list))
    ]

def save_execution_checkpoint_and_pause(line_number: int, scope_locals: dict):
    scope_locals_copy = scope_locals.copy()

    keys_to_clean_up = ['__builtins__', 'json', 'enrich_list', 'save_execution_checkpoint_and_pause']
    for key in keys_to_clean_up:
        if key in scope_locals_copy:
            del scope_locals_copy[key]

    checkpoint = {
        'lineNumber': line_number,
        'scopeLocals': scope_locals_copy,
        'sortingList': None
    }

    scope_globals = globals()

    if 'SORTING_LIST_VARIABLE_NAME' in scope_globals:
        checkpoint['sortingList'] = scope_globals['SORTING_LIST_VARIABLE_NAME']

    with open('/execution-control/checkpoint.json', 'w') as checkpoint_file:
        json.dump(checkpoint, checkpoint_file, indent='\t', default=str)

    input()

try:
    ##### User Code #####
#USER_CODE_INSERTION_HANDLE#
except KeyboardInterrupt:
    pass
