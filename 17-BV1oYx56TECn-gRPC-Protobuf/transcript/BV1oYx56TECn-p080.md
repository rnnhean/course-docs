[00:00] Now let's also implement the get student count RPC and for that let's bring up the main dot proto file and let's copy this function name. Now one more thing from the previous lecture I realized that I pasted this
[00:28] that I created this function in the students file. It needs to be in the teacher's credit file. All right, let's save this.
[00:51] And let's save this as well. All right, let's get back to working on this. And now this function needs a receiver. And this should have been S asterisk server.
[01:20] And if you're wondering why this worked without the s then you need to recall that we did discuss this. We just need to pass the receiver but if we are not using this s if we are not using any value from this struct then we don't actually need the variable here. So just asterisk server is also doing the job perfectly and there's no error.
[01:50] and this is not wrong it's just convention that we use a variable over here but it's going to work without the variable as well because we are not accessing any values from the struct we are not accessing any fields or any properties or any other methods of this receiver all right so let's bring back s and let's get back to our RPC okay
[02:17] Alright, this is going to take a context and a request of type pb.teacher ID.
[02:32] And it's going to return a student count or an error. And let's scroll it now.
[03:01] Now again we need the teacher ID.
[03:14] and now let's connect to MongoDB
[03:41] and a lot of functionality is the same so up to this point it's the same
[04:07] let's copy this and let's first fix the errors mongodb.createMongoClient and now let's hit ctrl s and that's it okay now this time instead of getting the documents from the
[04:35] collection, we need the count of the documents. So for that, let's connect to the student's collection first. Now MongoDB Collection offers us a method that can
[05:02] automatically count the number of documents and that is dot count documents and it's that simple yes just pass it the context and the filter and it'll give you the count
[05:27] now let's handle the return values
[05:53] and now for the return value in the student count field of our response we need to convert that to int32 and if we just type count it's automatically going to convert that into int32.
[06:22] there we go and now we also need a nil error and that's it let's save this and let's restart the server and now let's test this and now our request is going to be of the same format so let me copy this
[06:48] so we have the list from our previous run and if I select student count and then bring up the example it's again the ID right so let's paste this and now we are going to get the student count for this teacher and here it is it's 47
[07:12] Now let's get student count for another teacher and who is the class teacher for 12a? Because we added a few more students for 12a and here's that so let's copy this Paste this here and send the request We have 50 students for this class
[07:41] Great. And if you use a blank value, then we get invalid teacher ID. And if it is an acceptable value for MongoDB, but it doesn't exist in our database, let's see. Then we get teacher not found. Great. All right, so our get student count RPC is also working perfectly.
[08:11] alright and now let's also refactor our code and separate the database functionality into the crud file alright so let's cut this
[08:32] I'm going to call this function get student count by teacher ID from DB.
[08:48] now this function needs teacher ID so let's use that as the function parameter
[09:14] And it's going to have to either return the count or an error.
[09:38] so now our return types are int comma error all right it's actually int 64 so here we go great and now because it's int 64 we cannot use nil we need to use zero
[10:04] not here and we will also need the context that's it
[10:27] Let's come back to teacher's RPC. Pass it the context and the teacher ID.
[10:53] and let's send an error response as per the error and now let's just save it and that's it let's restart the server and let's send one more request
[11:19] Perfect. And perfect. Alright, so our get student count RPC is also functioning perfectly.
[11:32] you
