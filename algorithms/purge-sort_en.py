values = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

i = 0 #tv#

while i < len(values) - 1:
    if values[i + 1] < values[i]:
        values.pop(i + 1)
    else:
        i += 1
