values = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

n = len(values) #t#

# Swap the elements at indices k and l
def swap(k, l): #s#
    values[k],values[l] = values[l],values[k]

for i in range(n - 1, 0, -1): #tv(2)#
    for j in range(i): #tv(1)#
        if values[j] > values[j + 1]:
            swap(j, j + 1)
