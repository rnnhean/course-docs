[00:00] For deactivating a user we need to first find the user by object ID by the user ID and then update just one field and that field is inactive status. It is currently set to false and we need to set it to true. That's it.
[00:19] So let's start working on the deactivate user RPC.
[00:41] And let's first create a Mongo client and handle the error.
[01:11] And again we need to first convert the string IDs to object IDs.
[01:40] And this time we have multiple IDs so it's going to be an array. And now we need to range over the IDs that we received with the request and convert them to
[02:04] object ID. Now here we see that we are accessing the ID using id.id and let's check the
[02:33] proto file what we did here so execs.proto and here we see that exec id's contains repeated id's which are of type exec id and exec id is simply string and we are not using exec id anywhere
[03:02] So this was just for example, we can remove this and we need to make these messages as per our requirements. So this is now going to be string. And similarly, I think we did the same for students dot proto. Let's see. Yes, student ID and we are not using student ID anywhere. So let's remove this.
[03:29] and change this to string and let's check for teachers as well. We do have teacher ID so there's no point in removing this from here. So now let's recompile all these files.
[03:58] All right, I need to get to the root folder and then run this. And here we go. So now we have the updated protocol buffer files. Perfect.
[04:23] Now we have an error in students.co. Alright, so now instead of passing students to delete, we can directly pass rec.getid. And we don't need this now. And save this and I'm going to close all the saved files because we have a lot of open files here.
[04:53] great and now I'm just going to keep execs open and execs crud great and now we can directly access the id let's now handle the return values
[05:17] and now let's append this obj id into the object id's slice. Alright so now that we have acceptable object id's for MongoDB
[05:42] Let's run the query to update the inactive status for all these object IDs. And for that we need to call client.database.collection and then update many. And now this time the filter is going to be a little longer.
[06:11] So let's create a new variable for filter. Alright, so our filter this time is going to be bson.m underscore ID and then again we are going to use bson.m struct and pass it dollar in. We have already gone over what dollar in means and what it does. Dollar in will check all the entries that it has against the documents that are available in the collection and match the underscore ID field
[06:41] with the array that is passed to dollar in. And now let's also create a variable that will hold the update argument. And now our update Beeson.m struct is going to contain dollar set as the key because we are setting value in the fields. And now we pass it the key and value pairs. So key is the field name.
[07:10] inactive status and value is true. Alright, so now let's pass the filter and update arguments.
[07:35] And now this time we need the modified count so we are going to handle the result value as well apart from the error.
[07:55] And now that we have the result ready, we can now return the response. And the confirmation is going to depend on the result. So that's called result.
[08:24] modified count, we are going to check if this is greater than zero. So what this is going to do is it's going to check if the modified count is greater than zero. If it's greater than zero then in that case it is true and that means those IDs were deactivated. But if modified count is not greater than zero then in that case then in that case it returns false and that means the client is notified that all the IDs have been inactivated.
[08:54] You can also choose to use update one and store all the IDs in a slice and then return the resulting slice to the client to let the client know that these are the IDs these are the users that have been deactivated. We just hadn't used update many in any of our examples so that's why I have used update many in this RPC. You can however choose to use
[09:19] update one and loop over all the IDs individually. All right and let's also fix this error. We can now safely use red dot get IDs here.
[09:47] now let's save this and restart our server alright and now let's send a request to deactivate user and I'm just going to send one ID initially and we have a confirmation true perfect and let's also confirm in the database
[10:16] so here we show inactive status false but let's refresh this and now inactive status is true now let's also inactivate the first user and also charlie
[10:45] So Alice and Charlie are both going to be deactivated after this request. Alright, so now let's send the request and confirmation true. Let's refresh and they are inactive now. Perfect. Alright, now for reactivating I have not implemented an RPC.
[11:14] because that is your task it's going to be similar exactly similar but instead of true it'll be false and that's it and you can name the RPCS activate user now I don't have activate user here so what I'm going to do is I'm going to access the database and change the values here
[11:43] Once you have made your code for activate user do share your code your github link or your code snippet in the comments. All right and now let's de-factor this RPC as well. So this is the code block that is going to be refactored.
[12:13] control shift R and that's it. And I'm going to name it deactivate user in DB. Now the type for the second parameter of this function is going to be a slice of string because we are going to pass it request dot get IDs.
[12:39] The return values from this function are going to be just update result and the error. So let's also correct all the return statements here.
[13:00] And let's also remove the MongoDB from this MongoDB.createMongoClient because I'm going to move this to execscrud. And
[13:27] This rec.get ID is going to change into IDs. And now let's save this and get back to the deactivate user RPC to correct that as well.
[13:51] and this is going to be red dot get IDs and that is it just hit ctrl s and the errors are gone and our deactivate user RPC is finished
[14:17] you
