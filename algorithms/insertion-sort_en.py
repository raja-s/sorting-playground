values = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

n = len(values) #t#

# Remove the element at index k
# and reinsert it at index l
def reinsert(k, l): #s#
    values.insert(l, values.pop(k))

for i in range(1, n): #tv(2)#
    insertion_index = i #t#
    for j in range(i - 1, -1, -1): #tv(1)#
        if values[j] > values[i]:
            insertion_index = j
        else:
            break
    reinsert(i, insertion_index)
