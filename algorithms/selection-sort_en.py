values = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

n = len(values) #t#

# Swap the elements at indices k and l
def swap(k, l): #s#
    values[k],values[l] = values[l],values[k]

for i in range(n - 1): #tv(2)#
    minimum_index = i #t#
    for j in range(i + 1, n): #tv(1)#
        if values[j] < values[minimum_index]:
            minimum_index = j
    swap(minimum_index, i)
