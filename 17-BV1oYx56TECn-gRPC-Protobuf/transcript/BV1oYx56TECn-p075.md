[00:00] Alright, so it's time to work on our GET RPCs. Let's close the server. Alright, now let's introduce the GET execs from DB. Alright, and we just need to copy that over from.
[00:29] teachers. Alright and that is it.
[00:58] and we just need to change all the mention of teacher to exec
[01:17] and just hit ctrl s and we're done all right and now let's also define the get execs RPC so
[01:44] Copy this.
[02:04] And that is it.
[02:28] and let's also work on student's crud and for that I'm going to copy gare execs
[02:58] And hit save. That's it.
[03:26] And now I'm going to copy GETXX2 to the student's handler file.
[03:51] All right and we are done with get students as well. Now in case of students you remember that we implemented pagination because we have 335 students
[04:19] So let's implement pagination in MongoDB as well. So let's bring up student's crud. Now apart from context, sort options and filter, we are also going to need page number and page size.
[04:44] and both of them are not going to be more than in 32 so let's keep them in 32 instead of int because our protocol buffer file also uses in 32 and if we are using int then we will have to use type conversion and just to avoid that I'm using in 32 and it actually makes sense because
[05:09] None of these values are going to go over the maximum value of int32. And actually this is going to be positive so... In the students.protofile I can actually make this unsigned int32 to increase the maximum value that it can hold.
[05:39] So here we have page number so instead of in 32 it will be unsigned in 32. And now that means we need to again compile our files. Okay, let me open another terminal in the root. Alright, now let's run the command and here we go.
[06:05] no error this time and and our protocol buffer file is generated according to UIN32 for both. Alright so now let's close this and here now I'm going to use UIN32 to avoid type conversion and to maximize the value that we can hold for page size and page number.
[06:32] and we know that these can only be positive numbers. Alright, now let me close the terminal. Alright, so now when we are using MongoDB Go package in our API, implementing pagination becomes even more easier. So let me show you how that is.
[06:58] we have options.find here right and it then sets the sort options similarly we can again call options.find and then set skip value for this and we see here that set skip takes int64 value
[07:24] So we are going to convert whatever we calculate inside these parentheses into int64 and that we can do by calling int64 and then performing the calculation inside these parentheses. So the calculation is simple. We call page number minus one and then multiply that by the page size. This is going to be our offset value.
[07:53] So here we see setSkip sets the value for the skip field. So these are the number of documents that it's going to skip and then return the remaining documents. Similarly now we need to also set the limit. So here
[08:19] when we type SE we see the option set limit and set limit also takes value of type int64 so let's call int64 and then pass the page size as an argument and that's it. Alright and now one approach would be to move these over and pass these as an argument
[08:46] But this makes this statement too long. And usually in programming, we don't like that. We want our code to be modular and readable. So let me take this off from here and let me undo this. All right. So what we can do is we can create an instance of options dot find. So let's do that. It's going to be called find options. And this is options dot find.
[09:13] and on this find options I'm going to call these methods and not just these two I'm also going to use set sort on this that's it
[09:40] And now I'm going to pass find options here as an argument. That's it. So now instead of three arguments passed one after another and making this statement a little difficult to read, now we have a little more readability using this method. Great. So the MongoDB package makes our job easier again.
[10:06] Now let's fix this. And now we need to access the values for page number and page size. But if they don't exist, then we are going to provide default values for these variables. And page number is equal to get page number.
[10:35] And page size. And this should be go for assignment. All right, rec dot get page size. And now let's provide default values. So if page number is less than one, then page number is going to be equal to one.
[11:03] And similarly if page size is less than 1 then page size is going to be 10. And now let's pass these values to the get students from db function.
[11:30] All right, so now that we have the implementation for get execs as well as get students, let's try and test these. So let's restart a server and send a request. First, let's try get students. I'm not going to use any, I'm not going to send anything in the request body. And here we go. Great. Let's see what happens.
[12:00] And let me maximize this. So now we have a paginated response, right? Well, no, wait. Okay, well, we are not passing the find options if we don't have any sort options. So now this condition is actually going to change. All right, so actually this sort option is going to come here.
[12:28] so if length of sort options is greater than zero then we are going to use this sort option and now this else and now this else is gone and this is also gone and now we don't need to declare the cursor here we can just use go for assignment here
[12:55] So we are setting the sort option depending on the condition that we have any sort option in the request. If we don't, then we are not going to apply the sort option in the find options instance. Alright, so now this is going to work. Let's restart the server. And maximize this.
[13:22] All right. So we have so many values from our previous run. Now let's invoke the. So now let's send this request again. Great. So now we only have limited values and we have one, two, three, four, five, six, seven, eight, nine and 10. Great.
[13:51] That's perfect and we did not send any request and we still got a response as per the default values without any sorting applied. And now let's send another request and this time I'm going to send some values with the request. So let's use an example message. All right and page number.
[14:16] Alright, so I'm going to use page number two, actually just page number one. But page limit, the page size is going to be 18. And I'm going to sort by, sort by first name. And let's also sort by last name.
[14:46] This is going to be ascending. And this is descending. Great. And that's it. And the filter will be what? We have students, right? So a class will be a good filter.
[15:15] so the class will be 10a and let's format this and now let's send the request and here we have the result great so we should have 18 results
[15:40] one two three four another four results eight twelve sixteen and two eighteen perfect and they are of all ten a class they all belong to ten a
[16:08] And... And we have Abigail, Aidan, Alexander, another Alexander, and the same last name. Avery, Benjamin, Benjamin, again both Wilson's. Okay, David Wilson, Eleanor, Eleanor Jones. We don't have same first name and different last name.
[16:38] Well, this is close. Eli and Elijah, Gonzalez Rodriguez, Emily Rodriguez and another Emily Rodriguez, Emma Garcia. All right, so we have Hannah Martinez and Hannah Jones. J comes before M and the last name is arranged in descending order. So J is after M in our sorting. Great.
[17:04] great so now we have fully functioning getRPCs as well and now let's move on to modifying values
[17:12] you
